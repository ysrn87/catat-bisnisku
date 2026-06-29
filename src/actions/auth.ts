'use server';

import { signIn, signOut } from '@/auth';
import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { checkLoginLimit, checkRegisterMemberLimit, getIP } from '@/lib/ratelimit';

// ─── Login ────────────────────────────────────────────────────────────────────
// Sekarang hanya pakai email sebagai identifier

export async function loginAction(formData: FormData) {
  const email    = (formData.get('identifier') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  const ip          = getIP(await headers());
  const rateLimited = await checkLoginLimit(ip);
  if (!rateLimited.success) {
    return { success: false, error: rateLimited.error };
  }

  try {
    await signIn('credentials', { email, password, redirect: false });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { success: false, error: 'Email atau password salah, atau email belum diverifikasi.' };
        default:
          return { success: false, error: 'Terjadi kesalahan. Silakan coba lagi.' };
      }
    }
    throw error;
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logoutAction() {
  await signOut({ redirectTo: '/login' });
}

// ─── Register Member ──────────────────────────────────────────────────────────
// Member loyalty: email required, phone optional

export async function registerMemberAction(formData: FormData) {
  try {
    const name     = (formData.get('name')     as string)?.trim();
    const rawEmail = (formData.get('email')    as string)?.trim().toLowerCase();
    const rawPhone = (formData.get('phone')    as string)?.trim() || null;
    const password = formData.get('password') as string;
    const birthday = formData.get('birthday') as string;
    const storeId  = formData.get('storeId')  as string;

    const ip          = getIP(await headers());
    const rateLimited = await checkRegisterMemberLimit(ip);
    if (!rateLimited.success) {
      return { success: false, error: rateLimited.error };
    }

    if (!name)     return { success: false, error: 'Nama wajib diisi' };
    if (!rawEmail) return { success: false, error: 'Email wajib diisi' };
    if (!password) return { success: false, error: 'Password wajib diisi' };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(rawEmail)) {
      return { success: false, error: 'Format email tidak valid' };
    }
    if (password.length < 8) {
      return { success: false, error: 'Password minimal 8 karakter' };
    }

    if (rawPhone) {
      const phoneDigits = rawPhone.replace(/\D/g, '');
      if (phoneDigits.length < 9 || phoneDigits.length > 15) {
        return { success: false, error: 'Nomor telepon tidak valid' };
      }
    }

    const { db } = await import('@/lib/db');
    const bcrypt  = await import('bcryptjs');
    const crypto  = await import('crypto');
    const emailLib = await import('@/lib/email');

    if (storeId) {
      const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true } });
      if (!store) return { success: false, error: 'Toko tidak ditemukan' };
    }

    // Cek apakah email sudah terdaftar
    const existingUser = await db.user.findUnique({ where: { email: rawEmail } });

    if (existingUser) {
      if (existingUser.password) {
        return { success: false, error: 'Email sudah terdaftar. Silakan login.' };
      }

      // User ada tapi belum punya password (dibuat via invitation) — set password
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name:          existingUser.name || name,
            phone:         rawPhone ?? existingUser.phone,
            birthday:      birthday ? new Date(birthday) : existingUser.birthday,
            password:      hashedPassword,
            emailVerified: true, // email sudah diverifikasi via invitation
          },
        });
        if (storeId) {
          await tx.storeUser.upsert({
            where:  { storeId_userId: { storeId, userId: existingUser.id } },
            create: { storeId, userId: existingUser.id, points: 0 },
            update: {},
          });
        }
      });
      return { success: true };
    }

    // Cek phone unik (jika diisi)
    if (rawPhone) {
      const existingPhone = await db.user.findUnique({ where: { phone: rawPhone } });
      if (existingPhone) return { success: false, error: 'Nomor telepon sudah terdaftar' };
    }

    // User baru — buat akun + kirim verifikasi email
    const hashedPassword = await bcrypt.hash(password, 10);
    const verifyToken    = crypto.randomBytes(32).toString('hex');
    const expiresAt      = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email:         rawEmail,
          phone:         rawPhone,
          password:      hashedPassword,
          birthday:      birthday ? new Date(birthday) : null,
          emailVerified: false,
        },
      });

      await tx.emailVerification.create({
        data: { userId: newUser.id, token: verifyToken, expiresAt },
      });

      if (storeId) {
        await tx.storeUser.create({
          data: { storeId, userId: newUser.id, points: 0 },
        });
      }
    });

    // Kirim email verifikasi
    try {
      const verifyLink        = `${emailLib.getAppUrl()}/api/auth/verify-email?token=${verifyToken}`;
      const { subject, html } = emailLib.emailVerificationTemplate({ name, link: verifyLink });
      await emailLib.sendEmail({ to: rawEmail, subject, html });
    } catch (emailErr) {
      console.error('[registerMember] Gagal kirim email verifikasi:', emailErr);
    }

    return { success: true, needsVerification: true };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Gagal membuat akun. Silakan coba lagi.' };
  }
}
