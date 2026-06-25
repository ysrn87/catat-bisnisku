'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { sanitizeName, sanitizeText } from '@/lib/sanitize';
import { requireStoreAccess } from '@/lib/store-context';
import bcrypt from 'bcryptjs';

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

export async function upgradeToMemberAction(userId: string, formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized - Admin access required' };
    }

    const storeUser = await db.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!storeUser)                        return { success: false, error: 'Customer tidak ditemukan di toko ini' };
    if (storeUser.role !== 'CUSTOMER')     return { success: false, error: 'Customer sudah menjadi member' };

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: 'User tidak ditemukan' };

    const password   = formData.get('password')  as string | null;
    const email      = formData.get('email')     as string | null;
    const birthday   = formData.get('birthday')  as string | null;
    const photoUrl   = formData.get('photoUrl')  as string | null;
    const name       = sanitizeName(formData.get('name') as string, 100);
    const phone      = normalizePhone(formData.get('phone') as string);
    const grantRetro = formData.get('grantRetroPoints') === 'true';

    if (!name || !phone) return { success: false, error: 'Nama dan telepon wajib diisi' };

    const needsPassword = !user.password;
    if (needsPassword && (!password || password.length < 6)) {
      return { success: false, error: 'Password wajib diisi (min. 6 karakter) agar member bisa login' };
    }

    if (phone !== user.phone) {
      const phoneConflict = await db.user.findFirst({ where: { phone, NOT: { id: userId } } });
      if (phoneConflict) return { success: false, error: 'Nomor telepon sudah digunakan akun lain' };
    }

    const normalizedEmail = email ? email.trim().toLowerCase() : null;
    if (normalizedEmail) {
      const emailConflict = await db.user.findFirst({ where: { email: normalizedEmail, NOT: { id: userId } } });
      if (emailConflict) return { success: false, error: 'Email sudah terdaftar' };
    }

    await db.$transaction(async (tx) => {
      // FIX: hapus address dari userUpdate
      const userUpdate: any = { name, phone, email: normalizedEmail };
      if (birthday)                     userUpdate.birthday = new Date(birthday);
      if (photoUrl)                     userUpdate.photoUrl = photoUrl;
      if (needsPassword && password)    userUpdate.password = await bcrypt.hash(password, 10);

      await tx.user.update({ where: { id: userId }, data: userUpdate });

      await tx.storeUser.update({
        where: { storeId_userId: { storeId, userId } },
        data:  { role: 'MEMBER' },
      });

      // FIX: PointHistory pakai storeUserId + delta
      await tx.pointHistory.create({
        data: {
          storeUserId: storeUser.id,
          type:        'UPGRADE',
          delta:       0,
          description: 'Upgrade dari Customer ke Member',
        },
      });

      // Backfill poin retroaktif dari transaksi sebelumnya
      if (grantRetro) {
        const pastSales = await tx.sale.findMany({
          where:  { storeId, customerId: userId },
          select: { id: true, saleNumber: true, pointsEarned: true },
        });
        const retroPoints = pastSales.reduce((sum, s) => sum + s.pointsEarned, 0);
        if (retroPoints > 0) {
          await tx.storeUser.update({
            where: { storeId_userId: { storeId, userId } },
            data:  { points: { increment: retroPoints } },
          });
          await tx.pointHistory.create({
            data: {
              storeUserId: storeUser.id,
              type:        'ADJUST',
              delta:       retroPoints,
              description: `Poin retroaktif dari ${pastSales.length} transaksi sebelum upgrade ke member`,
            },
          });
        }
      }
    });

    revalidatePath(`/${storeSlug}/admin/transactions/customers`);
    revalidatePath(`/${storeSlug}/manager/transactions/customers`);
    return { success: true };
  } catch (error) {
    console.error('Upgrade to member error:', error);
    return { success: false, error: 'Gagal upgrade customer ke member' };
  }
}

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
