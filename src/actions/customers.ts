'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { sanitizeName, sanitizeText } from '@/lib/sanitize';
import { requireStoreAccess } from '@/lib/store-context';
import bcrypt from 'bcryptjs';

const normalizePhone = (phone: string) =>
  phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

// ─── Customer customer (CUSTOMER role) ─────────────────────────────────────────

export async function createWalkInCustomerAction(formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER' && storeRole !== 'CASHIER') {
      return { success: false, error: 'Unauthorized' };
    }

    const name    = sanitizeName(formData.get('name') as string, 100);
    const phone   = normalizePhone(formData.get('phone') as string);
    const address = sanitizeText(formData.get('address') as string, 200);

    if (!name || !phone) return { success: false, error: 'Nama dan nomor telepon wajib diisi' };
    if (phone.length < 9 || phone.length > 15) return { success: false, error: 'Nomor telepon tidak valid' };

    // Check if a User with this phone already exists anywhere in the platform
    let user = await db.user.findFirst({ where: { phone } });

    if (user) {
      // User exists — check if they already have a role at this store
      const existingStoreUser = await db.storeUser.findUnique({
        where: { storeId_userId: { storeId, userId: user.id } },
      });

      if (existingStoreUser) {
        // Already at this store — update name/address if they differ
        if (existingStoreUser.role === 'CUSTOMER') {
          await db.user.update({ where: { id: user.id }, data: { name, address: address || null } });
        }
        return { success: false, error: `${user.name} sudah terdaftar di toko ini` };
      }

      // Not yet at this store → add as CUSTOMER
      await db.storeUser.create({ data: { storeId, userId: user.id, role: 'CUSTOMER', points: 0 } });
    } else {
      // No user with this phone → create a passwordless User
      user = await db.user.create({
        data: { name, phone, address: address || null, password: null, role: 'MEMBER' },
      });
      await db.storeUser.create({ data: { storeId, userId: user.id, role: 'CUSTOMER', points: 0 } });
    }

    revalidatePath(`/${storeSlug}/admin/transactions/customers`);
    revalidatePath(`/${storeSlug}/manager/transactions/customers`);
    revalidatePath(`/${storeSlug}/cashier/transactions/customers`);
    return { success: true, data: { id: user.id, name: user.name, phone: user.phone, address: user.address ?? '' } };
  } catch (error) {
    console.error('Create customer error:', error);
    return { success: false, error: 'Gagal membuat customer' };
  }
}

// Keep old name as alias so existing call-sites compile without changes
export const createNonMemberCustomerAction = createWalkInCustomerAction;

export async function updateWalkInCustomerAction(userId: string, formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER' && storeRole !== 'CASHIER') {
      return { success: false, error: 'Unauthorized' };
    }

    const name    = sanitizeName((formData.get('name') as string)?.trim(), 100);
    const phone   = normalizePhone(formData.get('phone') as string);
    const address = sanitizeText((formData.get('address') as string)?.trim(), 200);

    if (!name || !phone) return { success: false, error: 'Nama dan nomor telepon wajib diisi' };
    if (phone.length < 9 || phone.length > 15) return { success: false, error: 'Nomor telepon tidak valid' };

    const storeUser = await db.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!storeUser || storeUser.role !== 'CUSTOMER') {
      return { success: false, error: 'Customer tidak ditemukan di toko ini' };
    }

    // Guard phone uniqueness across all users
    const phoneConflict = await db.user.findFirst({ where: { phone, NOT: { id: userId } } });
    if (phoneConflict) return { success: false, error: 'Nomor telepon sudah digunakan akun lain' };

    await db.user.update({ where: { id: userId }, data: { name, phone, address: address || null } });

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

// ─── Purchase history (works for both CUSTOMER and MEMBER) ────────────────────

export async function getCustomerPurchaseHistory(userId: string) {
  try {
    const { storeId, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER' && storeRole !== 'CASHIER') {
      throw new Error('Unauthorized');
    }

    const sales = await db.sale.findMany({
      where: { storeId, customerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        cashier: { select: { name: true } },
      },
    });

    return sales.map((sale) => {
      const { subtotal, discount, tax, total, items, ...rest } = sale;
      const ongkir = (rest as any).ongkir; delete (rest as any).ongkir;
      return {
        ...rest,
        subtotal: Number(subtotal),
        discount: Number(discount),
        tax:      Number(tax),
        ongkir:   Number(ongkir),
        total:    Number(total),
        items: items.map((item) => {
          const { price, subtotal: s, variant, ...ir } = item;
          const { price: vp, cost: vc, ...vr } = variant;
          return { ...ir, price: Number(price), subtotal: Number(s), variant: { ...vr, price: Number(vp), cost: Number(vc) } };
        }),
      };
    });
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

    if (!storeUser) return { success: false, error: 'Customer tidak ditemukan di toko ini' };
    if (storeUser.role !== 'CUSTOMER') {
      return { success: false, error: 'Customer sudah menjadi member' };
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: 'User tidak ditemukan' };

    const password    = formData.get('password')  as string | null;
    const email       = formData.get('email')     as string | null;
    const birthday    = formData.get('birthday')  as string | null;
    const photoUrl    = formData.get('photoUrl')  as string | null;
    const name        = sanitizeName(formData.get('name') as string, 100);
    const phone       = normalizePhone(formData.get('phone') as string);
    const address     = sanitizeText(formData.get('address') as string, 200);
    const grantRetro  = formData.get('grantRetroPoints') === 'true';

    if (!name || !phone || !address) return { success: false, error: 'Nama, telepon, dan alamat wajib diisi' };

    // Password only required if the user doesn't already have one
    const needsPassword = !user.password;
    if (needsPassword) {
      if (!password || password.length < 6) {
        return { success: false, error: 'Password wajib diisi (min. 6 karakter) agar member bisa login' };
      }
    }

    // Phone uniqueness — only check if changed
    if (phone !== user.phone) {
      const phoneConflict = await db.user.findFirst({ where: { phone, NOT: { id: userId } } });
      if (phoneConflict) return { success: false, error: 'Nomor telepon sudah digunakan akun lain' };
    }

    // Email uniqueness
    const normalizedEmail = email ? email.trim().toLowerCase() : null;
    if (normalizedEmail) {
      const emailConflict = await db.user.findFirst({ where: { email: normalizedEmail, NOT: { id: userId } } });
      if (emailConflict) return { success: false, error: 'Email sudah terdaftar' };
    }

    await db.$transaction(async (tx) => {
      const userUpdate: any = { name, phone, address, email: normalizedEmail };
      if (birthday) userUpdate.birthday = new Date(birthday);
      if (photoUrl) userUpdate.photoUrl = photoUrl;
      if (needsPassword && password) userUpdate.password = await bcrypt.hash(password, 10);

      await tx.user.update({ where: { id: userId }, data: userUpdate });

      // Promote role at this store — this is the core of the upgrade
      await tx.storeUser.update({
        where: { storeId_userId: { storeId, userId } },
        data: { role: 'MEMBER' },
      });

      // Optionally backfill points from past customer purchases
      if (grantRetro) {
        const pastSales = await tx.sale.findMany({
          where: { storeId, customerId: userId },
          select: { id: true, saleNumber: true, pointsEarned: true },
        });
        const retroPoints = pastSales.reduce((sum, s) => sum + s.pointsEarned, 0);
        if (retroPoints > 0) {
          await tx.storeUser.update({
            where: { storeId_userId: { storeId, userId } },
            data: { points: { increment: retroPoints } },
          });
          await tx.pointHistory.create({
            data: {
              userId, storeId,
              points:      retroPoints,
              type:        'ADJUSTED',
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

// Legacy alias — upgrade dialog currently calls this name
export const upgradeToMemberActionLegacy = upgradeToMemberAction;

// ─── Get all customers ────────────────────────────────────────────────

export async function getAllNonMemberCustomers() {
  try {
    const { storeId, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER' && storeRole !== 'CASHIER') {
      throw new Error('Unauthorized');
    }

    const storeUsers = await db.storeUser.findMany({
      where: { storeId, role: 'CUSTOMER' },
      include: {
        user: {
          select: { id: true, name: true, phone: true, address: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return storeUsers.map((su) => ({
      id:        su.user.id,
      name:      su.user.name,
      phone:     su.user.phone,
      address:   su.user.address ?? '',
      createdAt: su.user.createdAt,
    }));
  } catch (error) {
    console.error('Get customers error:', error);
    throw error;
  }
}
