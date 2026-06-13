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

export async function registerStoreAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  slug?: string;
}> {
  try {
    const storeName     = (formData.get('storeName')     as string)?.trim();
    const storeSlug     = (formData.get('storeSlug')     as string)?.trim().toLowerCase();
    const ownerName     = (formData.get('ownerName')     as string)?.trim();
    const ownerPhone    = (formData.get('ownerPhone')    as string)?.trim();
    const ownerEmail    = (formData.get('ownerEmail')    as string)?.trim().toLowerCase() || null;
    const ownerPassword = (formData.get('ownerPassword') as string);

    // ─── Validasi ────────────────────────────────────────────────────────────
    if (!storeName)     return { success: false, error: 'Nama toko wajib diisi' };
    if (!storeSlug)     return { success: false, error: 'Slug toko wajib diisi' };
    if (!ownerName)     return { success: false, error: 'Nama pemilik wajib diisi' };
    if (!ownerPhone)    return { success: false, error: 'Nomor telepon wajib diisi' };
    if (!ownerPassword) return { success: false, error: 'Password wajib diisi' };

    if (ownerPassword.length < 6) return { success: false, error: 'Password minimal 6 karakter' };

    // Validasi slug: hanya huruf kecil, angka, dan tanda hubung
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(storeSlug)) {
      return { success: false, error: 'Slug hanya boleh huruf kecil, angka, dan tanda hubung (-)' };
    }
    if (storeSlug.length < 3 || storeSlug.length > 50) {
      return { success: false, error: 'Slug harus antara 3–50 karakter' };
    }

    // Validasi phone
    const phoneRegex = /^[0-9+\-\s()]+$/;
    if (!phoneRegex.test(ownerPhone) || ownerPhone.replace(/\D/g, '').length < 9) {
      return { success: false, error: 'Nomor telepon tidak valid' };
    }

    // Validasi email
    if (ownerEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(ownerEmail)) {
        return { success: false, error: 'Format email tidak valid' };
      }
    }

    // ─── Cek duplikat ────────────────────────────────────────────────────────
    const [existingSlug, existingPhone, existingEmail] = await Promise.all([
      db.store.findUnique({ where: { slug: storeSlug } }),
      db.user.findFirst({ where: { phone: ownerPhone } }),
      ownerEmail ? db.user.findFirst({ where: { email: ownerEmail } }) : Promise.resolve(null),
    ]);

    if (existingSlug)  return { success: false, error: `Slug "${storeSlug}" sudah digunakan. Pilih slug lain.` };
    if (existingPhone) return { success: false, error: 'Nomor telepon sudah terdaftar. Silakan login.' };
    if (existingEmail) return { success: false, error: 'Email sudah terdaftar. Silakan login.' };

    // ─── Buat Owner + Store + StoreUser + Settings dalam satu transaksi ──────
    const hashedPassword = await bcrypt.hash(ownerPassword, 10);

    const store = await db.$transaction(async (tx) => {
      // 1. Buat owner user
      const owner = await tx.user.create({
        data: {
          name:     ownerName,
          phone:    ownerPhone,
          email:    ownerEmail,
          password: hashedPassword,
          role:     'ADMINISTRATOR',
        },
      });

      // 2. Buat store
      const newStore = await tx.store.create({
        data: {
          name:      storeName,
          slug:      storeSlug,
          plan:      'FREE',
          ownerId:   owner.id,
          updatedAt: new Date(),
        },
      });

      // 3. Hubungkan owner ke store sebagai OWNER
      await tx.storeUser.create({
        data: { storeId: newStore.id, userId: owner.id, role: 'OWNER' },
      });

      // 4. Buat settings default untuk store ini
      const defaultSettings = [
        { key: 'pointsConversionRate',    value: '1000', description: 'Konversi poin ke Rupiah (1 poin = X Rupiah)' },
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

export async function checkSlugAvailability(slug: string): Promise<{ available: boolean }> {
  if (!slug || slug.length < 3) return { available: false };

  const existing = await db.store.findUnique({ where: { slug } });
  return { available: !existing };
}
