'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess, getStoreContext } from '@/lib/store-context';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  // requireStoreAccess memastikan user terautentikasi dan punya akses ke store
  const { storeId } = await requireStoreAccess();
  const setting = await db.settings.findUnique({
    where: { storeId_key: { storeId, key } },
  });
  return setting?.value ?? null;
}

export async function getPointsConversionRate(): Promise<number> {
  const setting = await getSetting('pointsConversionRate');
  return setting ? parseInt(setting) : DEFAULT_SETTINGS.pointsConversionRate;
}

export async function getAllSettings() {
  const { storeId } = await requireStoreAccess();
  const settings = await db.settings.findMany({
    where: { storeId },
    orderBy: { key: 'asc' },
  });

  const map: Record<string, string> = {};
  settings.forEach((s) => { map[s.key] = s.value; });

  return {
    pointsConversionRate:    map.pointsConversionRate    ?? DEFAULT_SETTINGS.pointsConversionRate.toString(),
    minPointsForRedemption:  map.minPointsForRedemption  ?? DEFAULT_SETTINGS.minPointsForRedemption.toString(),
    maxPointsPerTransaction: map.maxPointsPerTransaction ?? DEFAULT_SETTINGS.maxPointsPerTransaction.toString(),
  };
}

export async function updateSetting(key: string, value: string, description?: string) {
  const { storeId, storeSlug, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    throw new Error('Unauthorized - Admin access required');
  }

  await db.settings.upsert({
    where:  { storeId_key: { storeId, key } },
    update: { value, description: description ?? undefined },
    create: { storeId, key, value, description: description ?? undefined, updatedAt: new Date() },
  });

  revalidatePath(`/${storeSlug}/admin/settings`);
  revalidatePath(`/${storeSlug}/admin/transactions/sales`);
  revalidatePath(`/${storeSlug}/manager/transactions/sales`);
}

export async function updatePointsConversionRate(rate: number) {
  if (rate < 100 || rate > 10000) throw new Error('Conversion rate harus antara 100 dan 10.000');
  await updateSetting('pointsConversionRate', rate.toString(), 'Konversi poin ke Rupiah (1 poin = X Rupiah)');
}

export async function updateMinPointsForRedemption(minPoints: number) {
  if (minPoints < 1 || minPoints > 1000) throw new Error('Minimum poin harus antara 1 dan 1.000');
  await updateSetting('minPointsForRedemption', minPoints.toString(), 'Minimum poin yang bisa ditukar');
}

export async function updateMaxPointsPerTransaction(maxPoints: number) {
  if (maxPoints < 10) throw new Error('Maksimum poin minimal 10');
  await updateSetting('maxPointsPerTransaction', maxPoints.toString(), 'Maksimum poin per transaksi');
}

export async function initializeSettings() {
  const { storeId, storeSlug, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    throw new Error('Unauthorized');
  }

  const defaults = [
    { key: 'pointsConversionRate',    value: DEFAULT_SETTINGS.pointsConversionRate.toString(),    description: 'Konversi poin ke Rupiah' },
    { key: 'minPointsForRedemption',  value: DEFAULT_SETTINGS.minPointsForRedemption.toString(),  description: 'Minimum poin yang bisa ditukar' },
    { key: 'maxPointsPerTransaction', value: DEFAULT_SETTINGS.maxPointsPerTransaction.toString(), description: 'Maksimum poin per transaksi' },
  ];

  for (const s of defaults) {
    await db.settings.upsert({
      where:  { storeId_key: { storeId, key: s.key } },
      update: {},
      create: { storeId, key: s.key, value: s.value, description: s.description, updatedAt: new Date() },
    });
  }

  revalidatePath(`/${storeSlug}/admin/settings`);
}

// ─── Admin Profile ─────────────────────────────────────────────────────────────

export async function getAdminProfile() {
  const { storeRole } = await requireStoreAccess();
  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    throw new Error('Unauthorized - Admin access required');
  }

  const session = await auth();
  const admin = await db.user.findUnique({
    where: { id: session!.user.id },
    select: { id: true, name: true, email: true, phone: true, address: true },
  });

  if (!admin) throw new Error('Admin not found');
  return admin;
}

export async function updateAdminProfile(data: {
  name?: string; email?: string; phone?: string; address?: string;
}) {
  const { storeSlug, storeRole } = await requireStoreAccess();
  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    throw new Error('Unauthorized - Admin access required');
  }

  const session = await auth();
  const userId = session!.user.id;

  if (data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) throw new Error('Format email tidak valid');
    const existing = await db.user.findFirst({ where: { email: data.email, NOT: { id: userId } } });
    if (existing) throw new Error('Email sudah digunakan');
  }

  if (data.phone) {
    const phoneRegex = /^[0-9+\-\s()]+$/;
    if (!phoneRegex.test(data.phone)) throw new Error('Format nomor telepon tidak valid');
    const existing = await db.user.findFirst({ where: { phone: data.phone, NOT: { id: userId } } });
    if (existing) throw new Error('Nomor telepon sudah digunakan');
  }

  await db.user.update({
    where: { id: userId },
    data: {
      ...(data.name    && { name:    data.name }),
      ...(data.email   && { email:   data.email }),
      ...(data.phone   && { phone:   data.phone }),
      ...(data.address !== undefined && { address: data.address }),
    },
  });

  revalidatePath(`/${storeSlug}/admin/settings`);
}

export async function updateAdminPassword(currentPassword: string, newPassword: string) {
  const { storeSlug, storeRole } = await requireStoreAccess();
  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    throw new Error('Unauthorized - Admin access required');
  }

  const session = await auth();
  const admin = await db.user.findUnique({ where: { id: session!.user.id } });
  if (!admin) throw new Error('Admin not found');
  if (!admin.password) throw new Error('Akun ini belum memiliki password. Silakan set password melalui halaman profil.');

  const isValid = await bcrypt.compare(currentPassword, admin.password);
  if (!isValid) throw new Error('Password saat ini tidak benar');
  if (newPassword.length < 6) throw new Error('Password minimal 6 karakter');

  await db.user.update({
    where: { id: admin.id },
    data: { password: await bcrypt.hash(newPassword, 10) },
  });

  revalidatePath(`/${storeSlug}/admin/settings`);
}

// ─── Branding ─────────────────────────────────────────────────────────────────

/**
 * Update logo toko — hanya PRO.
 * Menerima base64 string dari client (max ~100KB setelah kompresi).
 * Disimpan langsung di kolom logoUrl sebagai data URL.
 */
export async function updateStoreBrandingAction(logoBase64: string | null): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    const { storeId, storeSlug, storePlan } = await requireStoreAccess();

    if (storePlan !== 'PRO') {
      return { success: false, error: 'Fitur custom branding hanya tersedia untuk plan PRO.' };
    }

    // Validasi ukuran: base64 ≈ 4/3 ukuran asli, 150KB base64 ≈ 112KB file
    if (logoBase64 && logoBase64.length > 150_000) {
      return { success: false, error: 'Ukuran logo maksimal 100KB. Kompres gambar terlebih dahulu.' };
    }

    await db.store.update({
      where: { id: storeId },
      data: { logoUrl: logoBase64 },
    });

    revalidatePath(`/${storeSlug}/admin`);
    revalidatePath(`/${storeSlug}/admin/settings/profile`);
    return { success: true };

  } catch (error) {
    console.error('updateStoreBranding error:', error);
    return { success: false, error: 'Gagal menyimpan logo.' };
  }
}

/**
 * Ambil data branding toko saat ini.
 */
export async function getStoreBranding(): Promise<{ logoUrl: string | null; storeName: string }> {
  const { storeId } = await requireStoreAccess();
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { name: true, logoUrl: true },
  });
  return { logoUrl: store?.logoUrl ?? null, storeName: store?.name ?? '' };
}
