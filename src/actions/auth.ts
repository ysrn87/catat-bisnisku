'use server';

import { signIn, signOut } from '@/auth';
import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { checkLoginLimit, checkRegisterMemberLimit, getIP } from '@/lib/ratelimit';

const normalizePhone = (phone: string): string =>
  phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

const normalizeEmail = (email: string | null | undefined): string | null => {
  if (!email || email.trim() === '') return null;
  return email.trim().toLowerCase();
};

export async function loginAction(formData: FormData) {
  const identifier = formData.get('identifier') as string;
  const password   = formData.get('password')   as string;

  const ip          = getIP(await headers());
  const rateLimited = await checkLoginLimit(ip);
  if (!rateLimited.success) {
    return { success: false, error: rateLimited.error };
  }

  try {
    await signIn('credentials', { identifier, password, redirect: false });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { success: false, error: 'Email/telepon atau password salah' };
        default:
          return { success: false, error: 'Terjadi kesalahan. Silakan coba lagi.' };
      }
    }
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: '/login' });
}

export async function registerMemberAction(formData: FormData) {
  try {
    const name     = formData.get('name')     as string;
    const rawPhone = formData.get('phone')    as string;
    const rawEmail = formData.get('email')    as string;
    const password = formData.get('password') as string;
    const birthday = formData.get('birthday') as string;
    const storeId  = formData.get('storeId')  as string;

    const ip          = getIP(await headers());
    const rateLimited = await checkRegisterMemberLimit(ip);
    if (!rateLimited.success) {
      return { success: false, error: rateLimited.error };
    }

    const phone = normalizePhone(rawPhone);
    const email = normalizeEmail(rawEmail);

    if (!name || !phone || !password) {
      return { success: false, error: 'Nama, nomor telepon, dan password wajib diisi' };
    }
    if (password.length < 6) {
      return { success: false, error: 'Password minimal 6 karakter' };
    }
    if (phone.length < 9 || phone.length > 15) {
      return { success: false, error: 'Nomor telepon tidak valid' };
    }
    const { db } = await import('@/lib/db');
    const bcrypt  = await import('bcryptjs');

    // FIX: storeId sekarang opsional — member bisa daftar mandiri tanpa toko,
    // lalu join toko belakangan lewat /join-store. storeId hanya dipakai kalau
    // pendaftaran datang dari link toko tertentu (?storeId=xxx).
    if (storeId) {
      const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true } });
      if (!store) {
        return { success: false, error: 'Toko tidak ditemukan' };
      }
    }

    const existingUser = await db.user.findFirst({ where: { phone } });

    if (existingUser) {
      // Akun sudah ada dan sudah punya password → suruh login
      if (existingUser.password) {
        return { success: false, error: 'Nomor telepon sudah terdaftar. Silakan login.' };
      }

      // CUSTOMER (password null) → hanya set password + upgrade role.
      // Nama yang dipakai tetap nama yang sudah ada di DB (dicatat toko),
      // bukan nama dari form — mencegah user menimpa nama record toko secara sembarangan.
      if (email) {
        const emailConflict = await db.user.findFirst({ where: { email, NOT: { id: existingUser.id } } });
        if (emailConflict) return { success: false, error: 'Email sudah terdaftar' };
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            // Nama dan birthday hanya diisi kalau belum ada (CUSTOMER mungkin belum lengkap)
            name:     existingUser.name || name,
            email:    email ?? existingUser.email,
            birthday: birthday ? new Date(birthday) : existingUser.birthday,
            password: hashedPassword,
          },
        });

        // FIX: StoreUser hanya dibuat kalau storeId ada (link toko tertentu)
        if (storeId) {
          await tx.storeUser.upsert({
            where:  { storeId_userId: { storeId, userId: existingUser.id } },
            create: { storeId, userId: existingUser.id, role: 'MEMBER', points: 0 },
            update: { role: 'MEMBER' },
          });
        }
      });

      return { success: true };
    }

    // User baru — buat akun, dan join toko kalau storeId disediakan
    if (email) {
      const existingEmail = await db.user.findFirst({ where: { email } });
      if (existingEmail) return { success: false, error: 'Email sudah terdaftar' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name, phone, email,
          password: hashedPassword,
          birthday: birthday ? new Date(birthday) : null,
        },
      });

      // FIX: StoreUser hanya dibuat kalau storeId ada
      if (storeId) {
        await tx.storeUser.create({
          data: { storeId, userId: newUser.id, role: 'MEMBER', points: 0 },
        });
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Gagal membuat akun. Silakan coba lagi.' };
  }
}