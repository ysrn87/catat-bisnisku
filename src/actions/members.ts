'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess, getStoreContext } from '@/lib/store-context';
import { sanitizeName, sanitizeText } from '@/lib/sanitize';
import bcrypt from 'bcryptjs';

const normalizePhone = (phone: string): string =>
  phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

const normalizeEmail = (email: string | null | undefined): string | null => {
  if (!email || email.trim() === '') return null;
  return email.trim().toLowerCase();
};

// ─── Member-facing actions ─────────────────────────────────────────────────────

export async function getMemberPoints() {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  const { storeId } = await getStoreContext();

  const storeUser = await db.storeUser.findUnique({
    where:  { storeId_userId: { storeId, userId: session.user.id } },
    select: { points: true },
  });
  return storeUser?.points ?? 0;
}

export async function getPointsHistory() {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  const { storeId } = await getStoreContext();

  // FIX: PointHistory sekarang via storeUser, query lewat storeUser.id
  const storeUser = await db.storeUser.findUnique({
    where:  { storeId_userId: { storeId, userId: session.user.id } },
    select: { id: true },
  });
  if (!storeUser) return [];

  return db.pointHistory.findMany({
    where:   { storeUserId: storeUser.id },
    orderBy: { createdAt: 'desc' },
    take:    50,
  });
}

export async function getPurchaseHistory() {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  const { storeId } = await getStoreContext();

  const purchases = await db.sale.findMany({
    where:   { customerId: session.user.id, storeId },
    orderBy: { createdAt: 'desc' },
    include: {
      items:   { include: { variant: { include: { product: true } } } },
      payment: { select: { method: true, status: true } }, // FIX: dari Payment
    },
  });

  return purchases.map((p) => ({
    ...p,
    subtotal: Number(p.subtotal),
    discount: Number(p.discount),
    tax:      Number(p.tax),
    ongkir:   Number(p.ongkir ?? 0),
    total:    Number(p.total),
    items: p.items.map((item) => ({
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
}

export async function redeemPoints(points: number, description: string) {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  if (!Number.isInteger(points) || points <= 0) throw new Error('Jumlah poin tidak valid');

  const { storeId } = await getStoreContext();

  const storeUser = await db.storeUser.findUnique({
    where:  { storeId_userId: { storeId, userId: session.user.id } },
    select: { id: true, points: true },
  });
  if (!storeUser || storeUser.points < points) throw new Error('Poin tidak mencukupi');

  await db.$transaction(async (tx) => {
    await tx.storeUser.update({
      where: { storeId_userId: { storeId, userId: session.user.id } },
      data:  { points: { decrement: points } },
    });

    // FIX: pakai storeUserId + delta (bukan userId + storeId + points)
    await tx.pointHistory.create({
      data: {
        storeUserId: storeUser.id,
        type:        'REDEEM',
        delta:       -points,
        description,
      },
    });
  });

  return true;
}

// ─── Admin/Manager-facing actions ─────────────────────────────────────────────

export async function getAllCustomers() {
  const { storeId, storeRole } = await requireStoreAccess();

  if (!['OWNER', 'ADMINISTRATOR', 'MANAGER'].includes(storeRole)) {
    throw new Error('Unauthorized');
  }

  const storeUsers = await db.storeUser.findMany({
    where:   { storeId, role: 'MEMBER' },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, birthday: true, photoUrl: true, createdAt: true },
      },
    },
    orderBy: { user: { name: 'asc' } },
  });

  return storeUsers.map((su) => ({ ...su.user, points: su.points }));
}

export async function getCustomerDetails(customerId: string) {
  const { storeId, storeRole } = await requireStoreAccess();

  if (!['OWNER', 'ADMINISTRATOR', 'MANAGER'].includes(storeRole)) {
    throw new Error('Unauthorized');
  }

  const storeUser = await db.storeUser.findUnique({
    where:   { storeId_userId: { storeId, userId: customerId } },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, birthday: true, photoUrl: true, createdAt: true },
      },
      // FIX: member sales sekarang diakses via StoreUser.memberSales (relasi "MemberSales"), bukan User.customerSales
      memberSales: {
        orderBy: { createdAt: 'desc' },
        take:    10,
        include: { items: { include: { variant: { include: { product: true } } } } },
      },
    },
  });
  if (!storeUser) throw new Error('Customer tidak ditemukan di store ini');

  return {
    ...storeUser.user,
    points: storeUser.points,
    sales: storeUser.memberSales,
  };
}

export async function checkPhoneExistsAction(phone: string): Promise<{
  exists: boolean;
  isAlreadyMember: boolean;
  name?: string;
}> {
  const { storeId } = await requireStoreAccess();
  const normalized  = normalizePhone(phone);
  if (!normalized || normalized.length < 9) return { exists: false, isAlreadyMember: false };

  const user = await db.user.findFirst({
    where:  { phone: normalized },
    select: { id: true, name: true },
  });

  if (!user) return { exists: false, isAlreadyMember: false };

  const storeUser = await db.storeUser.findUnique({
    where: { storeId_userId: { storeId, userId: user.id } },
  });

  return { exists: true, isAlreadyMember: !!storeUser, name: user.name };
}

// Toko hanya bisa MENAUTKAN akun yang sudah ada — tidak bisa membuat akun baru
// atau menyentuh password. User harus daftar sendiri via /register.
export async function createCustomerAction(formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized - Admin access required' };
    }

    const rawPhone = formData.get('phone') as string;
    const phone    = normalizePhone(rawPhone);

    if (!phone) return { success: false, error: 'Nomor telepon wajib diisi' };
    if (phone.length < 9 || phone.length > 15) return { success: false, error: 'Nomor telepon tidak valid' };

    // Hanya proses jika user sudah punya akun (password tidak null)
    const existingUser = await db.user.findFirst({
      where:  { phone },
      select: { id: true, name: true, password: true },
    });

    if (!existingUser) {
      return { success: false, error: 'Akun dengan nomor ini belum terdaftar. Minta pelanggan daftar sendiri via link /register.' };
    }

    if (!existingUser.password) {
      return { success: false, error: 'Akun ini belum memiliki password. Minta pelanggan selesaikan pendaftaran via /register terlebih dahulu.' };
    }

    const existingStoreUser = await db.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId: existingUser.id } },
    });

    if (existingStoreUser) {
      return { success: false, error: `${existingUser.name} sudah terdaftar di toko ini` };
    }

    await db.storeUser.create({
      data: { storeId, userId: existingUser.id, role: 'MEMBER', points: 0 },
    });

    revalidatePath(`/${storeSlug}/admin/transactions/customers`);
    revalidatePath(`/${storeSlug}/manager/transactions/customers`);
    return { success: true, linked: true, name: existingUser.name };
  } catch (error) {
    console.error('Link member error:', error);
    return { success: false, error: 'Gagal menautkan member' };
  }
}

export async function updateCustomerAction(id: string, formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized - Admin access required' };
    }

    const name        = sanitizeName(formData.get('name') as string, 100);
    const rawPhone    = formData.get('phone')        as string;
    const rawEmail    = formData.get('email')        as string;
    const birthday    = formData.get('birthday')     as string;
    const photoUrl    = formData.get('photoUrl')     as string;
    const newPassword = formData.get('password')     as string;
    const points      = formData.get('points') ? parseInt(formData.get('points') as string) : undefined;
    const pointsReason = formData.get('pointsReason') as string;

    const phone = normalizePhone(rawPhone);
    const email = normalizeEmail(rawEmail);

    if (!name || !phone) return { success: false, error: 'Nama dan telepon wajib diisi' };
    if (newPassword && newPassword.length < 6) return { success: false, error: 'Password minimal 6 karakter' };
    if (phone.length < 10 || phone.length > 15) return { success: false, error: 'Nomor telepon tidak valid' };

    const currentStoreUser = await db.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId: id } },
    });
    if (!currentStoreUser) return { success: false, error: 'Customer tidak ditemukan di store ini' };

    const currentUser = await db.user.findUnique({ where: { id } });
    if (!currentUser) return { success: false, error: 'Customer tidak ditemukan' };

    // FIX: updateData tanpa address
    const updateData: any = {
      name, phone, email,
      birthday: birthday ? new Date(birthday) : null,
      photoUrl: photoUrl || null,
    };

    if (newPassword?.trim()) {
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    if (points !== undefined && points !== currentStoreUser.points) {
      if (!pointsReason?.trim()) return { success: false, error: 'Alasan wajib diisi saat mengubah poin' };

      await db.$transaction(async (tx) => {
        await tx.storeUser.update({
          where: { storeId_userId: { storeId, userId: id } },
          data:  { points },
        });
        // FIX: PointHistory pakai storeUserId + delta
        await tx.pointHistory.create({
          data: {
            storeUserId: currentStoreUser.id,
            type:        'ADJUST',
            delta:       points - currentStoreUser.points,
            description: pointsReason,
          },
        });
      });
    }

    await db.user.update({ where: { id }, data: updateData });

    revalidatePath(`/${storeSlug}/admin/transactions/customers`);
    revalidatePath(`/${storeSlug}/manager/transactions/customers`);
    return { success: true };
  } catch (error) {
    console.error('Update customer error:', error);
    return { success: false, error: 'Gagal mengupdate customer' };
  }
}

export async function deleteCustomerAction(id: string) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized - Admin access required' };
    }

    const storeUser = await db.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId: id } },
    });
    if (!storeUser) return { success: false, error: 'Customer tidak ditemukan di store ini' };

    const salesCount = await db.sale.count({ where: { customerId: id, storeId } });
    if (salesCount > 0) return { success: false, error: 'Tidak bisa hapus customer yang punya riwayat penjualan' };

    // FIX: hapus syncGlobalRole, cukup delete StoreUser (cascade ke PointHistory)
    await db.storeUser.delete({ where: { storeId_userId: { storeId, userId: id } } });

    revalidatePath(`/${storeSlug}/admin/transactions/customers`);
    revalidatePath(`/${storeSlug}/manager/transactions/customers`);
    return { success: true };
  } catch (error) {
    console.error('Delete customer error:', error);
    return { success: false, error: 'Gagal menghapus customer' };
  }
}

export async function getCustomerPointsHistory(customerId: string, page = 1, pageSize = 10) {
  const { storeId, storeRole } = await requireStoreAccess();

  if (!['OWNER', 'ADMINISTRATOR', 'MANAGER'].includes(storeRole)) {
    throw new Error('Unauthorized');
  }

  const storeUser = await db.storeUser.findUnique({
    where: { storeId_userId: { storeId, userId: customerId } },
  });
  if (!storeUser) throw new Error('Customer tidak ditemukan di store ini');

  const skip = (page - 1) * pageSize;

  // FIX: query via storeUserId bukan userId + storeId
  const [history, total] = await Promise.all([
    db.pointHistory.findMany({
      where:   { storeUserId: storeUser.id },
      orderBy: { createdAt: 'desc' },
      skip, take: pageSize,
    }),
    db.pointHistory.count({ where: { storeUserId: storeUser.id } }),
  ]);

  return { history, total };
}