'use server';

import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { headers } from 'next/headers';
import { checkRegisterStoreLimit, getIP } from '@/lib/ratelimit';
import { MAX_STORES_PER_USER } from '@/lib/store-context';
import { sendEmail, getAppUrl, emailVerificationTemplate } from '@/lib/email';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type RegisterStoreResult =
  | { success: true; slug: string; needsVerification?: boolean }
  | { success: false; error: string };

export async function registerStoreAction(formData: FormData): Promise<RegisterStoreResult> {
  try {
    const ip          = getIP(await headers());
    const rateLimited = await checkRegisterStoreLimit(ip);
    if (!rateLimited.success) return { success: false, error: rateLimited.error };

    // ── Parse input ────────────────────────────────────────────────────────────
    const storeName     = (formData.get('storeName')     as string)?.trim();
    const storeSlug     = (formData.get('storeSlug')     as string)?.trim().toLowerCase();
    const ownerName     = (formData.get('ownerName')     as string)?.trim();
    const ownerEmail    = (formData.get('ownerEmail')    as string)?.trim().toLowerCase();
    const ownerPhone    = (formData.get('ownerPhone')    as string)?.trim() || null;
    const ownerPassword = (formData.get('ownerPassword') as string);

    // ── Validasi wajib ─────────────────────────────────────────────────────────
    if (!storeName)     return { success: false, error: 'Nama toko wajib diisi' };
    if (!storeSlug)     return { success: false, error: 'Slug toko wajib diisi' };
    if (!ownerEmail)    return { success: false, error: 'Email wajib diisi' };
    if (!ownerPassword) return { success: false, error: 'Password wajib diisi' };

    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(storeSlug)) {
      return { success: false, error: 'Slug hanya boleh huruf kecil, angka, dan tanda hubung (-)' };
    }
    if (storeSlug.length < 3 || storeSlug.length > 50) {
      return { success: false, error: 'Slug harus antara 3–50 karakter' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ownerEmail)) {
      return { success: false, error: 'Format email tidak valid' };
    }

    if (ownerPhone) {
      const phoneDigits = ownerPhone.replace(/\D/g, '');
      if (phoneDigits.length < 9 || phoneDigits.length > 15) {
        return { success: false, error: 'Nomor telepon tidak valid' };
      }
    }

    // ── Cek slug sudah dipakai ─────────────────────────────────────────────────
    const existingSlug = await db.store.findUnique({ where: { slug: storeSlug } });
    if (existingSlug) {
      return { success: false, error: `Slug "${storeSlug}" sudah digunakan. Pilih slug lain.` };
    }

    // ── Cek apakah email sudah terdaftar ──────────────────────────────────────
    const existingUser = await db.user.findUnique({ where: { email: ownerEmail } });

    if (existingUser) {
      // User sudah ada — verifikasi password lalu tambah toko baru
      if (!existingUser.password) {
        return { success: false, error: 'Akun ini belum memiliki password. Silakan set password melalui halaman profil.' };
      }
      if (!existingUser.emailVerified) {
        return { success: false, error: 'Email belum diverifikasi. Silakan cek inbox kamu.' };
      }

      const isPasswordValid = await bcrypt.compare(ownerPassword, existingUser.password);
      if (!isPasswordValid) {
        return { success: false, error: 'Password salah. Silakan coba lagi.' };
      }

      // ── Cek batas jumlah toko ──────────────────────────────────────────────
      const storeCount = await db.storeStaff.count({
        where: { userId: existingUser.id, role: 'OWNER' },
      });
      if (storeCount >= MAX_STORES_PER_USER) {
        return {
          success: false,
          error: `Kamu sudah memiliki ${storeCount} toko. Maksimum ${MAX_STORES_PER_USER} toko per akun.`,
        };
      }

      const store = await db.$transaction(async (tx) => {
        const newStore = await tx.store.create({
          data: { name: storeName, slug: storeSlug, plan: 'FREE', ownerId: existingUser.id, updatedAt: new Date() },
        });
        await tx.storeStaff.create({
          data: { storeId: newStore.id, userId: existingUser.id, role: 'OWNER' },
        });
        await createDefaultSettings(tx, newStore.id);
        return newStore;
      });

      return { success: true, slug: store.slug };
    }

    // ── User belum ada → buat user baru ───────────────────────────────────────
    if (!ownerName) return { success: false, error: 'Nama pemilik wajib diisi' };
    if (ownerPassword.length < 8) return { success: false, error: 'Password minimal 8 karakter' };
    if (!/[0-9!@#$%^&*]/.test(ownerPassword)) {
      return { success: false, error: 'Password harus mengandung minimal 1 angka atau simbol (!@#$%^&*)' };
    }

    // Cek phone unik (jika diisi)
    if (ownerPhone) {
      const existingPhone = await db.user.findUnique({ where: { phone: ownerPhone } });
      if (existingPhone) return { success: false, error: 'Nomor telepon sudah terdaftar' };
    }

    const hashedPassword = await bcrypt.hash(ownerPassword, 10);
    const verifyToken    = crypto.randomBytes(32).toString('hex');
    const expiresAt      = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam

    const store = await db.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          name:          ownerName,
          email:         ownerEmail,
          phone:         ownerPhone,
          password:      hashedPassword,
          emailVerified: false,
        },
      });

      // Buat token verifikasi email
      await tx.emailVerification.create({
        data: { userId: owner.id, token: verifyToken, expiresAt },
      });

      const newStore = await tx.store.create({
        data: { name: storeName, slug: storeSlug, plan: 'FREE', ownerId: owner.id, updatedAt: new Date() },
      });
      await tx.storeStaff.create({
        data: { storeId: newStore.id, userId: owner.id, role: 'OWNER' },
      });
      await createDefaultSettings(tx, newStore.id);
      return { store: newStore, owner };
    });

    // Kirim email verifikasi (di luar transaksi agar tidak block commit)
    try {
      const verifyLink = `${getAppUrl()}/api/auth/verify-email?token=${verifyToken}`;
      const { subject, html } = emailVerificationTemplate({ name: ownerName, link: verifyLink });
      await sendEmail({ to: ownerEmail, subject, html });
    } catch (emailErr) {
      console.error('[registerStore] Gagal kirim email verifikasi:', emailErr);
      // Tidak gagalkan registrasi — user bisa minta kirim ulang
    }

    return { success: true, slug: store.store.slug, needsVerification: true };

  } catch (error) {
    console.error('Register store error:', error);
    return { success: false, error: 'Terjadi kesalahan. Silakan coba lagi.' };
  }
}

// ── Helper: default settings ───────────────────────────────────────────────────

async function createDefaultSettings(tx: any, storeId: string) {
  const defaults = [
    { key: 'pointsConversionRate',    value: '1000', description: 'Konversi poin ke Rupiah' },
    { key: 'minPointsForRedemption',  value: '10',   description: 'Minimum poin yang bisa ditukar' },
    { key: 'maxPointsPerTransaction', value: '1000', description: 'Maksimum poin per transaksi' },
  ];
  for (const s of defaults) {
    await tx.storeSetting.upsert({
      where:  { storeId_key: { storeId, key: s.key } },
      update: {},
      create: { storeId, key: s.key, value: s.value, description: s.description, updatedAt: new Date() },
    });
  }
}

// ── Public helpers ─────────────────────────────────────────────────────────────

export async function checkEmailForStore(email: string): Promise<{ exists: boolean; name?: string }> {
  if (!email) return { exists: false };
  const user = await db.user.findUnique({
    where:  { email: email.toLowerCase() },
    select: { name: true },
  });
  return { exists: !!user, name: user?.name };
}

export async function checkSlugAvailability(slug: string): Promise<{ available: boolean }> {
  if (!slug || slug.length < 3) return { available: false };
  const existing = await db.store.findUnique({ where: { slug } });
  return { available: !existing };
}
