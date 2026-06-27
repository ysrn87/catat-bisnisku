'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { sanitizeName, sanitizeText } from '@/lib/sanitize';
import { requireStoreAccess } from '@/lib/store-context';

const normalizePhone = (phone: string) =>
  phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

// ─── CRUD Customer lokal (walk-in) ────────────────────────────────────────────

export async function createWalkInCustomerAction(formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR', 'MANAGER', 'CASHIER'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const name    = sanitizeName(formData.get('name') as string, 100);
    const phone   = normalizePhone(formData.get('phone') as string);
    const address = sanitizeText(formData.get('address') as string, 255);

    if (!name) return { success: false, error: 'Nama wajib diisi' };
    if (phone && (phone.length < 9 || phone.length > 15)) {
      return { success: false, error: 'Nomor telepon tidak valid' };
    }

    // Cegah duplikat phone dalam satu toko
    if (phone) {
      const existing = await db.customer.findFirst({
        where: { storeId, phone },
        select: { id: true, name: true },
      });
      if (existing) {
        return { success: false, error: `${existing.name} sudah terdaftar di toko ini` };
      }
    }

    const customer = await db.customer.create({
      data: { storeId, name, phone: phone || null, address: address || null },
    });

    revalidatePath(`/${storeSlug}/admin/transactions/customers`);
    revalidatePath(`/${storeSlug}/manager/transactions/customers`);
    revalidatePath(`/${storeSlug}/cashier/transactions/customers`);
    return { success: true, data: { id: customer.id, name: customer.name, phone: customer.phone } };
  } catch (error) {
    console.error('Create customer error:', error);
    return { success: false, error: 'Gagal membuat customer' };
  }
}

export const createNonMemberCustomerAction = createWalkInCustomerAction;

export async function updateWalkInCustomerAction(customerId: string, formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR', 'MANAGER', 'CASHIER'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const name    = sanitizeName((formData.get('name') as string)?.trim(), 100);
    const phone   = normalizePhone(formData.get('phone') as string);
    const address = sanitizeText(formData.get('address') as string, 255);

    if (!name) return { success: false, error: 'Nama wajib diisi' };
    if (phone && (phone.length < 9 || phone.length > 15)) {
      return { success: false, error: 'Nomor telepon tidak valid' };
    }

    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: { id: true, storeId: true },
    });
    if (!customer || customer.storeId !== storeId) {
      return { success: false, error: 'Customer tidak ditemukan di toko ini' };
    }

    // Cegah duplikat phone
    if (phone) {
      const conflict = await db.customer.findFirst({
        where: { storeId, phone, NOT: { id: customerId } },
      });
      if (conflict) return { success: false, error: 'Nomor telepon sudah digunakan customer lain' };
    }

    await db.customer.update({
      where: { id: customerId },
      data:  { name, phone: phone || null, address: address || null },
    });

    revalidatePath(`/${storeSlug}/admin/transactions/customers`);
    revalidatePath(`/${storeSlug}/manager/transactions/customers`);
    revalidatePath(`/${storeSlug}/cashier/transactions/customers`);
    return { success: true };
  } catch (error) {
    console.error('Update customer error:', error);
    return { success: false, error: 'Gagal mengupdate customer' };
  }
}

export const updateNonMemberCustomerAction = updateWalkInCustomerAction;

export async function deleteWalkInCustomerAction(customerId: string) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: { id: true, storeId: true },
    });
    if (!customer || customer.storeId !== storeId) {
      return { success: false, error: 'Customer tidak ditemukan di toko ini' };
    }

    const salesCount = await db.sale.count({ where: { customerId, storeId } });
    if (salesCount > 0) {
      return { success: false, error: 'Tidak bisa hapus customer yang punya riwayat penjualan' };
    }

    await db.customer.delete({ where: { id: customerId } });

    revalidatePath(`/${storeSlug}/admin/transactions/customers`);
    revalidatePath(`/${storeSlug}/manager/transactions/customers`);
    revalidatePath(`/${storeSlug}/cashier/transactions/customers`);
    return { success: true };
  } catch (error) {
    console.error('Delete customer error:', error);
    return { success: false, error: 'Gagal menghapus customer' };
  }
}

export const deleteNonMemberCustomerAction = deleteWalkInCustomerAction;

// ─── Purchase history (untuk tab Riwayat di CustomerDetailsDialog) ───────────

export async function getCustomerPurchaseHistory(customerId: string) {
  try {
    const { storeId, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR', 'MANAGER', 'CASHIER'].includes(storeRole)) {
      throw new Error('Unauthorized');
    }

    // customerId bisa berupa Customer.id (walk-in) ATAU StoreUser.id (member)
    // Coba keduanya
    const [customerSales, memberSales] = await Promise.all([
      db.sale.findMany({
        where:   { storeId, customerId },
        orderBy: { createdAt: 'desc' },
        include: {
          items:   { include: { variant: { include: { product: true } } } },
          cashier: { select: { name: true } },
          payment: { select: { method: true, status: true } },
        },
      }),
      db.sale.findMany({
        where:   { storeId, memberId: customerId },
        orderBy: { createdAt: 'desc' },
        include: {
          items:   { include: { variant: { include: { product: true } } } },
          cashier: { select: { name: true } },
          payment: { select: { method: true, status: true } },
        },
      }),
    ]);

    const allSales = [...customerSales, ...memberSales]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return allSales.map((sale) => ({
      ...sale,
      subtotal:      Number(sale.subtotal),
      discount:      Number(sale.discount),
      tax:           Number(sale.tax),
      ongkir:        Number(sale.ongkir),
      total:         Number(sale.total),
      paymentMethod: sale.payment?.method ?? 'CASH',
      paymentStatus: sale.payment?.status ?? 'PAID',
      items: sale.items.map((item) => ({
        ...item,
        price:    Number(item.price),
        subtotal: Number(item.subtotal),
        variant: {
          ...item.variant,
          price: Number(item.variant.price),
          cost:  Number(item.variant.cost),
        },
      })),
    }));
  } catch (error) {
    console.error('Get purchase history error:', error);
    throw error;
  }
}

// ─── Upgrade Customer → Member ────────────────────────────────────────────────
// Flow:
// 1. Cari User by phone yang sama dengan Customer
// 2. User harus sudah punya password (daftar sendiri)
// 3. Buat StoreUser role MEMBER
// 4. Link Customer.userId = User.id
// 5. (Opsional) Relink sale lama: customer sales tetap ada, member sales dari sini ke depan

export async function upgradeToMemberAction(customerId: string) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR', 'MANAGER'].includes(storeRole)) {
      return { success: false, error: 'Minimal role MANAGER untuk upgrade ke member' };
    }

    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: { id: true, storeId: true, name: true, phone: true, userId: true },
    });

    if (!customer || customer.storeId !== storeId) {
      return { success: false, error: 'Customer tidak ditemukan di toko ini' };
    }

    if (!customer.phone) {
      return { success: false, error: 'Customer belum punya nomor telepon. Update data customer terlebih dahulu.' };
    }

    // Cari User by phone
    const user = await db.user.findFirst({
      where:  { phone: customer.phone },
      select: { id: true, password: true, name: true },
    });

    if (!user) {
      return { success: false, error: `Belum ada akun dengan nomor ${customer.phone}. Minta pelanggan daftar di /register terlebih dahulu.` };
    }

    if (!user.password) {
      return { success: false, error: 'Akun ditemukan tapi belum selesai mendaftar. Minta pelanggan lengkapi pendaftaran.' };
    }

    // Cek apakah sudah jadi StoreUser di toko ini
    const existingStoreUser = await db.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId: user.id } },
    });

    if (existingStoreUser) {
      if (existingStoreUser.role === 'MEMBER') {
        return { success: false, error: `${user.name} sudah menjadi member di toko ini` };
      }
      // Kalau sudah ada sebagai role lain (CASHIER, MANAGER, dll) — jangan ubah
      return { success: false, error: `${user.name} sudah terdaftar di toko ini sebagai ${existingStoreUser.role}` };
    }

    await db.$transaction(async (tx) => {
      // Buat StoreUser role MEMBER
      const storeUser = await tx.storeUser.create({
        data: { storeId, userId: user.id, role: 'MEMBER', points: 0 },
      });

      // Catat di PointHistory
      await tx.pointHistory.create({
        data: {
          storeUserId: storeUser.id,
          type:        'UPGRADE',
          delta:       0,
          description: `Upgrade dari Customer ke Member`,
        },
      });

      // Link Customer.userId ke User
      await tx.customer.update({
        where: { id: customerId },
        data:  { userId: user.id },
      });
    });

    revalidatePath(`/${storeSlug}/admin/transactions/customers`);
    revalidatePath(`/${storeSlug}/manager/transactions/customers`);
    return { success: true, memberName: user.name };
  } catch (error) {
    console.error('Upgrade to member error:', error);
    return { success: false, error: 'Gagal upgrade customer ke member' };
  }
}

// Alias backward compat
export const upgradeToMemberActionLegacy = upgradeToMemberAction;

// ─── Ambil semua Customer (walk-in) untuk POS / dropdown ────────────────────

export async function getAllNonMemberCustomers() {
  try {
    const { storeId, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR', 'MANAGER', 'CASHIER'].includes(storeRole)) {
      throw new Error('Unauthorized');
    }

    const customers = await db.customer.findMany({
      where:   { storeId },
      orderBy: { name: 'asc' },
      select:  { id: true, name: true, phone: true, address: true, createdAt: true },
    });

    return customers;
  } catch (error) {
    console.error('Get customers error:', error);
    throw error;
  }
}
