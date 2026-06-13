'use server';

import { signIn, signOut } from '@/auth';
import { AuthError } from 'next-auth';

const normalizePhone = (phone: string): string =>
  phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

const normalizeEmail = (email: string | null | undefined): string | null => {
  if (!email || email.trim() === '') return null;
  return email.trim().toLowerCase();
};

export async function loginAction(formData: FormData) {
  const identifier = formData.get('identifier') as string;
  const password   = formData.get('password')   as string;

  try {
    await signIn('credentials', {
      identifier,
      password,
      redirect: false,
    });
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

/**
 * Register member baru (dipanggil dari halaman /register di dalam toko).
 * User akan otomatis didaftarkan sebagai MEMBER di store yang bersangkutan.
 */
export async function registerMemberAction(formData: FormData) {
  try {
    const name     = formData.get('name')     as string;
    const rawPhone = formData.get('phone')    as string;
    const rawEmail = formData.get('email')    as string;
    const address  = formData.get('address')  as string;
    const password = formData.get('password') as string;
    const birthday = formData.get('birthday') as string;
    const storeId  = formData.get('storeId')  as string; // ← wajib ada di form

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
    if (!storeId) {
      return { success: false, error: 'Store ID tidak ditemukan' };
    }

    const { db } = await import('@/lib/db');
    const bcrypt  = await import('bcryptjs');

    const existingPhone = await db.user.findFirst({ where: { phone } });
    if (existingPhone) {
      return { success: false, error: 'Nomor telepon sudah terdaftar' };
    }

    if (email) {
      const existingEmail = await db.user.findFirst({ where: { email } });
      if (existingEmail) {
        return { success: false, error: 'Email sudah terdaftar' };
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name, phone, email, address,
          password: hashedPassword,
          birthday: birthday ? new Date(birthday) : null,
          role: 'MEMBER',
          points: 0,
        },
      });

      // Daftarkan ke store sebagai MEMBER
      await tx.storeUser.create({
        data: { storeId, userId: newUser.id, role: 'MEMBER' },
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Gagal membuat akun. Silakan coba lagi.' };
  }
}
