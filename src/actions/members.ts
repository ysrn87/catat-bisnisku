'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess, getStoreContext } from '@/lib/store-context';

const normalizePhone = (phone: string): string =>
  phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

const normalizeEmail = (email: string | null | undefined): string | null => {
  if (!email || email.trim() === '') return null;
  return email.trim().toLowerCase();
};

// ─── Member-facing actions (pakai storeContext dari header) ────────────────────

export async function getMemberPoints() {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { points: true },
  });
  return user?.points || 0;
}

export async function getPointsHistory() {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  return db.pointHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function getPurchaseHistory() {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  const { storeId } = await getStoreContext();

  const purchases = await db.sale.findMany({
    where: { customerId: session.user.id, storeId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: { include: { variant: { include: { product: true } } } },
    },
  });

  return purchases.map((p) => ({
    ...p,
    subtotal: Number(p.subtotal),
    discount: Number(p.discount),
    tax:      Number(p.tax),
    ongkir:   Number((p as any).ongkir ?? 0),
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

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.points < points) throw new Error('Poin tidak mencukupi');

  await db.user.update({
    where: { id: session.user.id },
    data: { points: { decrement: points } },
  });

  await db.pointHistory.create({
    data: { userId: session.user.id, points: -points, type: 'REDEEMED', description },
  });

  return true;
}

// ─── Admin/Manager-facing actions ─────────────────────────────────────────────

export async function getAllCustomers() {
  const { storeId, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
    throw new Error('Unauthorized');
  }

  // Member = StoreUser dengan role MEMBER di store ini
  const storeUsers = await db.storeUser.findMany({
    where: { storeId, role: 'MEMBER' },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, birthday: true, photoUrl: true, points: true, createdAt: true },
      },
    },
    orderBy: { user: { name: 'asc' } },
  });

  return storeUsers.map((su) => su.user);
}

export async function getCustomerDetails(customerId: string) {
  const { storeId, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
    throw new Error('Unauthorized');
  }

  const storeUser = await db.storeUser.findUnique({
    where: { storeId_userId: { storeId, userId: customerId } },
  });
  if (!storeUser) throw new Error('Customer tidak ditemukan di store ini');

  return db.user.findUnique({
    where: { id: customerId },
    include: {
      sales: {
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { items: { include: { variant: { include: { product: true } } } } },
      },
      pointsHistory: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
}

/**
 * Cek apakah nomor HP sudah terdaftar di sistem.
 * Dipakai oleh CustomerDialog untuk deteksi user existing sebelum submit.
 */
export async function checkPhoneExistsAction(phone: string): Promise<{
  exists: boolean;
  isAlreadyMember: boolean;
  name?: string;
}> {
  const { storeId } = await requireStoreAccess();
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 9) return { exists: false, isAlreadyMember: false };

  const user = await db.user.findFirst({
    where: { phone: normalized },
    select: { id: true, name: true },
  });

  if (!user) return { exists: false, isAlreadyMember: false };

  // Cek apakah sudah jadi member di store ini
  const storeUser = await db.storeUser.findUnique({
    where: { storeId_userId: { storeId, userId: user.id } },
  });

  return {
    exists: true,
    isAlreadyMember: !!storeUser,
    name: user.name,
  };
}

export async function createCustomerAction(formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized - Admin access required' };
    }

    const name      = formData.get('name')         as string;
    const rawPhone  = formData.get('phone')         as string;
    const rawEmail  = formData.get('email')         as string;
    const password  = formData.get('password')      as string;
    const address   = formData.get('address')       as string;
    const birthday  = formData.get('birthday')      as string;
    const photoUrl  = formData.get('photoUrl')      as string;
    // Flag yang dikirim dari dialog ketika user memilih "link user existing"
    const linkExisting = formData.get('linkExisting') === 'true';

    const phone = normalizePhone(rawPhone);
    const email = normalizeEmail(rawEmail);

    if (!phone) return { success: false, error: 'Nomor telepon wajib diisi' };
    if (phone.length < 9 || phone.length > 15) return { success: false, error: 'Nomor telepon tidak valid' };

    // Cek apakah user dengan nomor ini sudah ada
    const existingUser = await db.user.findFirst({ where: { phone } });

    if (existingUser) {
      // ── User sudah ada di sistem ────────────────────────────────────────────

      // Cek apakah sudah jadi member di store ini
      const existingStoreUser = await db.storeUser.findUnique({
        where: { storeId_userId: { storeId, userId: existingUser.id } },
      });

      if (existingStoreUser) {
        return { success: false, error: `${existingUser.name} sudah terdaftar sebagai member di toko ini` };
      }

      if (!linkExisting) {
        // Dialog belum konfirmasi → kembalikan info untuk ditampilkan ke admin
        return {
          success: false,
          requiresConfirmation: true,
          existingName: existingUser.name,
          error: `Nomor HP ini sudah terdaftar atas nama "${existingUser.name}". Apakah ingin mendaftarkan mereka ke toko ini?`,
        };
      }

      // Admin sudah konfirmasi → link user existing ke store ini
      await db.storeUser.create({
        data: { storeId, userId: existingUser.id, role: 'MEMBER' },
      });

      revalidatePath(`/${storeSlug}/admin/sales-customers/customers`);
      revalidatePath(`/${storeSlug}/manager/sales-customers/customers`);
      return { success: true, linked: true, name: existingUser.name };
    }

    // ── User belum ada → buat baru ──────────────────────────────────────────
    if (!name || !address) {
      return { success: false, error: 'Nama dan alamat wajib diisi' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password minimal 6 karakter' };
    }

    if (email) {
      const existingEmail = await db.user.findFirst({ where: { email } });
      if (existingEmail) return { success: false, error: 'Email sudah terdaftar' };
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name, phone, email, address,
          password: hashedPassword,
          birthday: birthday ? new Date(birthday) : null,
          photoUrl: photoUrl || null,
          role: 'MEMBER',
          points: 0,
        },
      });
      await tx.storeUser.create({ data: { storeId, userId: newUser.id, role: 'MEMBER' } });
    });

    revalidatePath(`/${storeSlug}/admin/sales-customers/customers`);
    revalidatePath(`/${storeSlug}/manager/sales-customers/customers`);
    return { success: true, linked: false };
  } catch (error) {
    console.error('Create customer error:', error);
    return { success: false, error: 'Gagal membuat customer' };
  }
}

export async function updateCustomerAction(id: string, formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized - Admin access required' };
    }

    const name        = formData.get('name')        as string;
    const rawPhone    = formData.get('phone')        as string;
    const rawEmail    = formData.get('email')        as string;
    const address     = formData.get('address')      as string;
    const birthday    = formData.get('birthday')     as string;
    const photoUrl    = formData.get('photoUrl')     as string;
    const newPassword = formData.get('password')     as string;
    const points      = formData.get('points') ? parseInt(formData.get('points') as string) : undefined;
    const pointsReason = formData.get('pointsReason') as string;

    const phone = normalizePhone(rawPhone);
    const email = normalizeEmail(rawEmail);

    if (!name || !phone || !address) return { success: false, error: 'Nama, telepon, dan alamat wajib diisi' };
    if (newPassword && newPassword.length < 6) return { success: false, error: 'Password minimal 6 karakter' };
    if (phone.length < 10 || phone.length > 15) return { success: false, error: 'Nomor telepon tidak valid' };

    // Pastikan customer adalah member di store ini
    const storeUser = await db.storeUser.findUnique({ where: { storeId_userId: { storeId, userId: id } } });
    if (!storeUser) return { success: false, error: 'Customer tidak ditemukan di store ini' };

    const existingPhone = await db.user.findFirst({ where: { phone, id: { not: id } } });
    if (existingPhone) return { success: false, error: 'Nomor telepon sudah digunakan' };

    if (email) {
      const existingEmail = await db.user.findFirst({ where: { email, id: { not: id } } });
      if (existingEmail) return { success: false, error: 'Email sudah terdaftar' };
    }

    const currentUser = await db.user.findUnique({ where: { id }, select: { points: true } });
    if (!currentUser) return { success: false, error: 'Customer tidak ditemukan' };

    const updateData: any = { name, phone, email, address: address || null, birthday: birthday ? new Date(birthday) : null, photoUrl: photoUrl || null };

    if (newPassword?.trim()) {
      const bcrypt = require('bcryptjs');
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    if (points !== undefined && points !== currentUser.points) {
      if (!pointsReason?.trim()) return { success: false, error: 'Alasan wajib diisi saat mengubah poin' };
      updateData.points = points;
      await db.pointHistory.create({
        data: { userId: id, points: points - currentUser.points, type: 'ADJUSTED', description: pointsReason },
      });
    }

    await db.user.update({ where: { id }, data: updateData });

    revalidatePath(`/${storeSlug}/admin/sales-customers/customers`);
    revalidatePath(`/${storeSlug}/manager/sales-customers/customers`);
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

    const storeUser = await db.storeUser.findUnique({ where: { storeId_userId: { storeId, userId: id } } });
    if (!storeUser) return { success: false, error: 'Customer tidak ditemukan di store ini' };

    const salesCount = await db.sale.count({ where: { customerId: id, storeId } });
    if (salesCount > 0) return { success: false, error: 'Tidak bisa hapus customer yang punya riwayat penjualan' };

    // Hapus StoreUser saja, user-nya tetap ada
    await db.storeUser.delete({ where: { storeId_userId: { storeId, userId: id } } });

    revalidatePath(`/${storeSlug}/admin/sales-customers/customers`);
    revalidatePath(`/${storeSlug}/manager/sales-customers/customers`);
    return { success: true };
  } catch (error) {
    console.error('Delete customer error:', error);
    return { success: false, error: 'Gagal menghapus customer' };
  }
}

export async function getCustomerPointsHistory(customerId: string, page = 1, pageSize = 10) {
  const { storeId, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
    throw new Error('Unauthorized');
  }

  const storeUser = await db.storeUser.findUnique({ where: { storeId_userId: { storeId, userId: customerId } } });
  if (!storeUser) throw new Error('Customer tidak ditemukan di store ini');

  const skip = (page - 1) * pageSize;
  const [history, total] = await Promise.all([
    db.pointHistory.findMany({ where: { userId: customerId }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    db.pointHistory.count({ where: { userId: customerId } }),
  ]);

  return { history, total };
}
