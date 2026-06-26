'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { sanitizeName, sanitizeText } from '@/lib/sanitize';
import { requireStoreAccess } from '@/lib/store-context';

const normalizePhone = (phone: string) =>
  phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

// ─── Customer (CUSTOMER role) ──────────────────────────────────────────────────

export async function createWalkInCustomerAction(formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR', 'MANAGER', 'CASHIER'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const name  = sanitizeName(formData.get('name') as string, 100);
    const phone = normalizePhone(formData.get('phone') as string);

    if (!name || !phone) return { success: false, error: 'Nama dan nomor telepon wajib diisi' };
    if (phone.length < 9 || phone.length > 15) return { success: false, error: 'Nomor telepon tidak valid' };

    let user = await db.user.findFirst({ where: { phone } });

    if (user) {
      const existingStoreUser = await db.storeUser.findUnique({
        where: { storeId_userId: { storeId, userId: user.id } },
      });

      if (existingStoreUser) {
        if (existingStoreUser.role === 'CUSTOMER') {
          await db.user.update({ where: { id: user.id }, data: { name } });
        }
        return { success: false, error: `${user.name} sudah terdaftar di toko ini` };
      }

      await db.storeUser.create({ data: { storeId, userId: user.id, role: 'CUSTOMER', points: 0 } });
    } else {
      // FIX: hapus address dan role dari User.create
      user = await db.user.create({
        data: { name, phone, password: null },
      });
      await db.storeUser.create({ data: { storeId, userId: user.id, role: 'CUSTOMER', points: 0 } });
    }

    revalidatePath(`/${storeSlug}/admin/transactions/customers`);
    revalidatePath(`/${storeSlug}/manager/transactions/customers`);
    revalidatePath(`/${storeSlug}/cashier/transactions/customers`);
    return { success: true, data: { id: user.id, name: user.name, phone: user.phone } };
  } catch (error) {
    console.error('Create customer error:', error);
    return { success: false, error: 'Gagal membuat customer' };
  }
}

export const createNonMemberCustomerAction = createWalkInCustomerAction;

export async function updateWalkInCustomerAction(userId: string, formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR', 'MANAGER', 'CASHIER'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const name  = sanitizeName((formData.get('name') as string)?.trim(), 100);
    const phone = normalizePhone(formData.get('phone') as string);

    if (!name || !phone) return { success: false, error: 'Nama dan nomor telepon wajib diisi' };
    if (phone.length < 9 || phone.length > 15) return { success: false, error: 'Nomor telepon tidak valid' };

    const storeUser = await db.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!storeUser || storeUser.role !== 'CUSTOMER') {
      return { success: false, error: 'Customer tidak ditemukan di toko ini' };
    }

    const phoneConflict = await db.user.findFirst({ where: { phone, NOT: { id: userId } } });
    if (phoneConflict) return { success: false, error: 'Nomor telepon sudah digunakan akun lain' };

    // FIX: hapus address dari update
    await db.user.update({ where: { id: userId }, data: { name, phone } });

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

export async function deleteWalkInCustomerAction(userId: string) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized' };
    }

    const storeUser = await db.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!storeUser || storeUser.role !== 'CUSTOMER') {
      return { success: false, error: 'Customer tidak ditemukan di toko ini' };
    }

    const salesCount = await db.sale.count({ where: { customerId: userId, storeId } });
    if (salesCount > 0) {
      return { success: false, error: 'Tidak bisa hapus customer yang punya riwayat penjualan' };
    }

    // FIX: hapus syncGlobalRole — cascade ke PointHistory sudah dihandle schema
    await db.storeUser.delete({ where: { storeId_userId: { storeId, userId } } });

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

export async function getCustomerPurchaseHistory(userId: string) {
  try {
    const { storeId, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR', 'MANAGER', 'CASHIER'].includes(storeRole)) {
      throw new Error('Unauthorized');
    }

    const sales = await db.sale.findMany({
      where:   { storeId, customerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items:   { include: { variant: { include: { product: true } } } },
        cashier: { select: { name: true } },
        payment: { select: { method: true, status: true } }, // FIX: dari Payment
      },
    });

    return sales.map((sale) => ({
      ...sale,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      tax:      Number(sale.tax),
      ongkir:   Number(sale.ongkir),
      total:    Number(sale.total),
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

// ─── Upgrade CUSTOMER → MEMBER ─────────────────────────────────────────────────
// Skenario baru: user harus sudah punya akun sendiri (password tidak null).
// Upgrade hanya ubah role — tidak menyentuh password atau data profil.

export async function upgradeToMemberAction(userId: string) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR', 'MANAGER'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized - minimal role MANAGER' };
    }

    const storeUser = await db.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!storeUser)                    return { success: false, error: 'Customer tidak ditemukan di toko ini' };
    if (storeUser.role !== 'CUSTOMER') return { success: false, error: 'User ini bukan CUSTOMER' };

    // Pastikan user sudah punya password sendiri — tidak boleh toko yang set
    const user = await db.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (!user?.password) {
      return { success: false, error: 'Pelanggan belum punya akun. Minta mereka daftar sendiri via /register terlebih dahulu.' };
    }

    await db.$transaction(async (tx) => {
      await tx.storeUser.update({
        where: { storeId_userId: { storeId, userId } },
        data:  { role: 'MEMBER' },
      });

      await tx.pointHistory.create({
        data: {
          storeUserId: storeUser.id,
          type:        'UPGRADE',
          delta:       0,
          description: 'Upgrade dari Customer ke Member',
        },
      });
    });

    revalidatePath(`/${storeSlug}/admin/transactions/customers`);
    revalidatePath(`/${storeSlug}/manager/transactions/customers`);
    return { success: true };
  } catch (error) {
    console.error('Upgrade to member error:', error);
    return { success: false, error: 'Gagal upgrade customer ke member' };
  }
}

// Alias untuk backward compat — keduanya delegate ke fungsi yang sama
export const upgradeToMemberActionLegacy = upgradeToMemberAction;

export async function getAllNonMemberCustomers() {
  try {
    const { storeId, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR', 'MANAGER', 'CASHIER'].includes(storeRole)) {
      throw new Error('Unauthorized');
    }

    const storeUsers = await db.storeUser.findMany({
      where:   { storeId, role: 'CUSTOMER' },
      include: {
        user: {
          // FIX: hapus address dari select
          select: { id: true, name: true, phone: true, createdAt: true },
        },
      },
      orderBy: { joinedAt: 'desc' }, // FIX: createdAt → joinedAt (field baru di StoreUser)
    });

    return storeUsers.map((su) => ({
      id:        su.user.id,
      name:      su.user.name,
      phone:     su.user.phone,
      createdAt: su.user.createdAt,
    }));
  } catch (error) {
    console.error('Get customers error:', error);
    throw error;
  }
}