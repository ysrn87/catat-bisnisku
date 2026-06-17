'use server';

import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';


function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type RegisterStoreResult =
  | { success: true; slug: string }
  | { success: false; error: string; requiresLogin?: boolean; existingName?: string };

export async function registerStoreAction(formData: FormData): Promise<RegisterStoreResult> {
  try {
    const storeName     = (formData.get('storeName')     as string)?.trim();
    const storeSlug     = (formData.get('storeSlug')     as string)?.trim().toLowerCase();
    const ownerName     = (formData.get('ownerName')     as string)?.trim();
    const ownerPhone    = (formData.get('ownerPhone')    as string)?.trim();
    const ownerEmail    = (formData.get('ownerEmail')    as string)?.trim().toLowerCase() || null;
    const ownerPassword = (formData.get('ownerPassword') as string);
    // Flag: user existing yang sudah konfirmasi dengan password
    const isExistingUser = formData.get('isExistingUser') === 'true';

    // ─── Validasi wajib ───────────────────────────────────────────────────────
    if (!storeName)     return { success: false, error: 'Nama toko wajib diisi' };
    if (!storeSlug)     return { success: false, error: 'Slug toko wajib diisi' };
    if (!ownerPhone)    return { success: false, error: 'Nomor telepon wajib diisi' };
    if (!ownerPassword) return { success: false, error: 'Password wajib diisi' };

    // Validasi slug
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(storeSlug)) {
      return { success: false, error: 'Slug hanya boleh huruf kecil, angka, dan tanda hubung (-)' };
    }
    if (storeSlug.length < 3 || storeSlug.length > 50) {
      return { success: false, error: 'Slug harus antara 3–50 karakter' };
    }

    // Validasi phone
    const phoneDigits = ownerPhone.replace(/\D/g, '');
    if (phoneDigits.length < 9 || phoneDigits.length > 15) {
      return { success: false, error: 'Nomor telepon tidak valid' };
    }

    // Validasi email
    if (ownerEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(ownerEmail)) {
        return { success: false, error: 'Format email tidak valid' };
      }
    }

    // ─── Cek slug ─────────────────────────────────────────────────────────────
    const existingSlug = await db.store.findUnique({ where: { slug: storeSlug } });
    if (existingSlug) {
      return { success: false, error: `Slug "${storeSlug}" sudah digunakan. Pilih slug lain.` };
    }

    // ─── Cek apakah user sudah ada ────────────────────────────────────────────
    const existingUser = await db.user.findFirst({ where: { phone: ownerPhone } });

    if (existingUser) {
      // ── User sudah ada → verifikasi password, lalu buat store baru ──────────

      const isPasswordValid = await bcrypt.compare(ownerPassword, existingUser.password);
      if (!isPasswordValid) {
        return {
          success: false,
          requiresLogin: true,
          existingName: existingUser.name,
          error: `Nomor ini terdaftar atas nama "${existingUser.name}". Password salah, silakan coba lagi.`,
        };
      }

      // Password benar → buat store baru untuk user existing ini
      const store = await db.$transaction(async (tx) => {
        const newStore = await tx.store.create({
          data: {
            name:      storeName,
            slug:      storeSlug,
            plan:      'FREE',
            ownerId:   existingUser.id,
            updatedAt: new Date(),
          },
        });

        await tx.storeUser.create({
          data: { storeId: newStore.id, userId: existingUser.id, role: 'OWNER' },
        });

        const defaultSettings = [
          { key: 'pointsConversionRate',    value: '1000', description: 'Konversi poin ke Rupiah' },
          { key: 'minPointsForRedemption',  value: '10',   description: 'Minimum poin yang bisa ditukar' },
          { key: 'maxPointsPerTransaction', value: '1000', description: 'Maksimum poin per transaksi' },
        ];

        for (const s of defaultSettings) {
          await tx.settings.upsert({
            where:  { storeId_key: { storeId: newStore.id, key: s.key } },
            update: {},
            create: { storeId: newStore.id, key: s.key, value: s.value, description: s.description, updatedAt: new Date() },
          });
        }

        return newStore;
      });

      return { success: true, slug: store.slug };
    }

    // ── User belum ada → buat user baru + store ──────────────────────────────
    if (!ownerName) return { success: false, error: 'Nama pemilik wajib diisi' };
    if (ownerPassword.length < 8) return { success: false, error: 'Password minimal 8 karakter' };
    if (!/[0-9!@#$%^&*]/.test(ownerPassword)) return { success: false, error: 'Password harus mengandung minimal 1 angka atau simbol (!@#$%^&*)' };

    if (ownerEmail) {
      const existingEmail = await db.user.findFirst({ where: { email: ownerEmail } });
      if (existingEmail) return { success: false, error: 'Email sudah terdaftar' };
    }

    const hashedPassword = await bcrypt.hash(ownerPassword, 10);

    const store = await db.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          name:     ownerName,
          phone:    ownerPhone,
          email:    ownerEmail,
          password: hashedPassword,
          role:     'ADMINISTRATOR',
        },
      });

      const newStore = await tx.store.create({
        data: {
          name:      storeName,
          slug:      storeSlug,
          plan:      'FREE',
          ownerId:   owner.id,
          updatedAt: new Date(),
        },
      });

      await tx.storeUser.create({
        data: { storeId: newStore.id, userId: owner.id, role: 'OWNER' },
      });

      const defaultSettings = [
        { key: 'pointsConversionRate',    value: '1000', description: 'Konversi poin ke Rupiah' },
        { key: 'minPointsForRedemption',  value: '10',   description: 'Minimum poin yang bisa ditukar' },
        { key: 'maxPointsPerTransaction', value: '1000', description: 'Maksimum poin per transaksi' },
      ];

      for (const s of defaultSettings) {
        await tx.settings.upsert({
          where:  { storeId_key: { storeId: newStore.id, key: s.key } },
          update: {},
          create: { storeId: newStore.id, key: s.key, value: s.value, description: s.description, updatedAt: new Date() },
        });
      }

      return newStore;
    });

    return { success: true, slug: store.slug };

  } catch (error) {
    console.error('Register store error:', error);
    return { success: false, error: 'Terjadi kesalahan. Silakan coba lagi.' };
  }
}

export async function checkPhoneForStore(phone: string): Promise<{
  exists: boolean;
  name?: string;
}> {
  if (!phone || phone.replace(/\D/g, '').length < 9) return { exists: false };
  const user = await db.user.findFirst({
    where: { phone },
    select: { name: true },
  });
  return { exists: !!user, name: user?.name };
}

export async function checkSlugAvailability(slug: string): Promise<{ available: boolean }> {
  if (!slug || slug.length < 3) return { available: false };
  const existing = await db.store.findUnique({ where: { slug } });
  return { available: !existing };
}
