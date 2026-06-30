'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess, getStoreContext } from '@/lib/store-context';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const { storeId } = await requireStoreAccess();
  // FIX: db.settings → db.storeSetting
  const setting = await db.storeSetting.findUnique({
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
  // FIX: db.settings → db.storeSetting
  const settings = await db.storeSetting.findMany({
    where:   { storeId },
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

  // FIX: db.settings → db.storeSetting (tidak ada field updatedAt manual, sudah @updatedAt)
  await db.storeSetting.upsert({
    where:  { storeId_key: { storeId, key } },
    update: { value, description: description ?? undefined },
    create: { storeId, key, value, description: description ?? undefined },
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
    // FIX: db.settings → db.storeSetting
    await db.storeSetting.upsert({
      where:  { storeId_key: { storeId, key: s.key } },
      update: {},
      create: { storeId, key: s.key, value: s.value, description: s.description },
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
    where:  { id: session!.user.id },
    // FIX: hapus address — field ini tidak ada di User lagi
    select: { id: true, name: true, email: true, phone: true },
  });

  if (!admin) throw new Error('Admin not found');
  return admin;
}

export async function updateAdminProfile(data: {
  name?: string; phone?: string;
  // FIX: email DIHAPUS dari sini — ganti email sekarang lewat
  // requestEmailChangeAction() di bawah, yang butuh konfirmasi via link
  // sebelum email benar-benar berubah. Mengganti email secara langsung
  // tanpa konfirmasi membuka risiko account takeover: kalau email diganti
  // ke alamat yang salah/dikuasai orang lain, status emailVerified tetap
  // true padahal pemilik baru belum terbukti memegang akses ke alamat itu.
}) {
  const { storeSlug, storeRole } = await requireStoreAccess();
  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    throw new Error('Unauthorized - Admin access required');
  }

  const session = await auth();
  const userId  = session!.user.id;

  if (data.phone) {
    const phoneRegex = /^[0-9+\-\s()]+$/;
    if (!phoneRegex.test(data.phone)) throw new Error('Format nomor telepon tidak valid');
    const existing = await db.user.findFirst({ where: { phone: data.phone, NOT: { id: userId } } });
    if (existing) throw new Error('Nomor telepon sudah digunakan');
  }

  await db.user.update({
    where: { id: userId },
    data: {
      ...(data.name  && { name:  data.name }),
      ...(data.phone && { phone: data.phone }),
    },
  });

  revalidatePath(`/${storeSlug}/admin/settings`);
}

// ─────────────────────────────────────────────────────────────────────────────
// requestEmailChangeAction
// Email TIDAK langsung berubah di sini. Kita kirim link konfirmasi ke email
// BARU; baru saat link itu diklik (lihat /api/auth/confirm-email-change),
// kolom User.email benar-benar diperbarui. Sebelum dikonfirmasi, user tetap
// login dengan email lama seperti biasa.
// ─────────────────────────────────────────────────────────────────────────────

export async function requestEmailChangeAction(
  newEmailRaw: string,
  currentPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { storeSlug, storeRole } = await requireStoreAccess();
    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized - Admin access required' };
    }

    const session = await auth();
    const userId   = session!.user.id;

    const newEmail = newEmailRaw.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return { success: false, error: 'Format email tidak valid' };
    }

    const currentUser = await db.user.findUnique({ where: { id: userId } });
    if (!currentUser) return { success: false, error: 'User tidak ditemukan' };

    if (newEmail === currentUser.email) {
      return { success: false, error: 'Email baru sama dengan email saat ini' };
    }

    // Wajib konfirmasi password — mencegah orang yang sekadar menumpang
    // sesi yang sedang login (lupa logout di device bersama) mengganti email
    if (!currentUser.password) {
      return { success: false, error: 'Akun ini belum memiliki password' };
    }
    const bcrypt    = await import('bcryptjs');
    const isValidPw = await bcrypt.compare(currentPassword, currentUser.password);
    if (!isValidPw) {
      return { success: false, error: 'Password saat ini tidak benar' };
    }

    const existing = await db.user.findFirst({ where: { email: newEmail, NOT: { id: userId } } });
    if (existing) return { success: false, error: 'Email sudah digunakan akun lain' };

    const { default: crypto } = await import('crypto');
    const emailLib             = await import('@/lib/email');

    // Hapus token pending sebelumnya (kalau ada permintaan ganti email sebelumnya yang belum dikonfirmasi)
    await db.emailVerification.deleteMany({ where: { userId, newEmail: { not: null } } });

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 jam — lebih singkat dari verifikasi awal

    await db.emailVerification.create({
      data: { userId, token, newEmail, expiresAt },
    });

    const confirmLink        = `${emailLib.getAppUrl()}/api/auth/confirm-email-change?token=${token}`;
    const { subject, html }  = emailLib.emailChangeConfirmationTemplate({
      name:     currentUser.name,
      oldEmail: currentUser.email,
      newEmail,
      link:     confirmLink,
    });
    await emailLib.sendEmail({ to: newEmail, subject, html });

    return { success: true };
  } catch (err) {
    console.error('[requestEmailChangeAction]', err);
    return { success: false, error: 'Terjadi kesalahan. Silakan coba lagi.' };
  }
}

export async function updateAdminPassword(currentPassword: string, newPassword: string) {
  const { storeSlug, storeRole } = await requireStoreAccess();
  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    throw new Error('Unauthorized - Admin access required');
  }

  const session = await auth();
  const admin   = await db.user.findUnique({ where: { id: session!.user.id } });
  if (!admin) throw new Error('Admin not found');
  if (!admin.password) throw new Error('Akun ini belum memiliki password.');

  const isValid = await bcrypt.compare(currentPassword, admin.password);
  if (!isValid) throw new Error('Password saat ini tidak benar');

  // FIX: samakan syarat dengan register-store.ts — sebelumnya halaman ini
  // hanya mewajibkan 6 karakter tanpa syarat kompleksitas, sehingga user bisa
  // "menurunkan" kekuatan password mereka sendiri lewat menu ganti password.
  if (newPassword.length < 8) throw new Error('Password minimal 8 karakter');
  if (!/[0-9!@#$%^&*]/.test(newPassword)) {
    throw new Error('Password harus mengandung minimal 1 angka atau simbol (!@#$%^&*)');
  }

  await db.user.update({
    where: { id: admin.id },
    data:  { password: await bcrypt.hash(newPassword, 10) },
  });

  revalidatePath(`/${storeSlug}/admin/settings`);
}

// ─── Branding ─────────────────────────────────────────────────────────────────

export async function updateStoreBrandingAction(logoBase64: string | null): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    const { storeId, storeSlug, storePlan } = await requireStoreAccess();

    if (storePlan !== 'PRO') {
      return { success: false, error: 'Fitur custom branding hanya tersedia untuk plan PRO.' };
    }

    if (logoBase64 && logoBase64.length > 150_000) {
      return { success: false, error: 'Ukuran logo maksimal 100KB.' };
    }

    // FIX: validasi format sebelumnya hanya ada di client (handleFileChange
    // di branding-tab.tsx). Karena ini Server Action, validasi client bisa
    // dilewati sepenuhnya dengan memanggil action ini langsung — server
    // sebelumnya cuma cek panjang string, tidak cek isinya benar-benar data
    // URI gambar atau bukan. Tanpa ini, kolom logoUrl bisa dipakai
    // menyimpan string arbitrer apa saja asal di bawah 150KB.
    if (logoBase64 && !/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/]+=*$/.test(logoBase64)) {
      return { success: false, error: 'Format logo tidak valid. Gunakan JPG, PNG, atau WebP.' };
    }

    await db.store.update({
      where: { id: storeId },
      data:  { logoUrl: logoBase64 },
    });

    revalidatePath(`/${storeSlug}/admin`);
    revalidatePath(`/${storeSlug}/admin/settings/profile`);
    return { success: true };
  } catch (error) {
    console.error('updateStoreBranding error:', error);
    return { success: false, error: 'Gagal menyimpan logo.' };
  }
}

export async function getStoreBranding(): Promise<{ logoUrl: string | null; storeName: string }> {
  const { storeId } = await requireStoreAccess();
  const store = await db.store.findUnique({
    where:  { id: storeId },
    select: { name: true, logoUrl: true },
  });
  return { logoUrl: store?.logoUrl ?? null, storeName: store?.name ?? '' };
}
