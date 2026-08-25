'use server';

import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { headers } from 'next/headers';
import {
  sendEmail,
  getAppUrl,
  passwordResetTemplate,
} from '@/lib/email';
import {
  checkForgotPasswordLimit,
  checkResetPasswordLimit,
  getIP,
} from '@/lib/ratelimit';

const RESET_EXPIRES_HOURS = 1;

// ─────────────────────────────────────────────────────────────────────────────
// requestPasswordResetAction
// Dipanggil dari /forgot-password. SELALU balas { success: true } dengan pesan
// generik yang sama persis baik email ditemukan atau tidak, dan baik kena rate
// limit atau tidak — pola yang sama dengan resend-verification — supaya
// endpoint ini tidak bisa dipakai untuk mengecek email mana yang terdaftar.
// ─────────────────────────────────────────────────────────────────────────────

export async function requestPasswordResetAction(
  rawEmail: string
): Promise<{ success: true }> {
  const GENERIC_OK = { success: true as const };

  try {
    const email = rawEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return GENERIC_OK;
    }

    const ip          = getIP(await headers());
    const rateLimited = await checkForgotPasswordLimit(email, ip);
    if (!rateLimited.success) {
      return GENERIC_OK;
    }

    const user = await db.user.findUnique({
      where:  { email },
      select: { id: true, name: true },
    });
    if (!user) {
      return GENERIC_OK;
    }

    // Hapus token reset lama milik user ini — supaya link lama tidak bisa
    // dipakai lagi setelah user minta reset baru.
    await db.passwordReset.deleteMany({ where: { userId: user.id } });

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_EXPIRES_HOURS * 60 * 60 * 1000);

    await db.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetLink          = `${getAppUrl()}/reset-password?token=${token}`;
    const { subject, html }  = passwordResetTemplate({
      name:      user.name,
      link:      resetLink,
      expiresIn: `${RESET_EXPIRES_HOURS} jam`,
    });

    try {
      await sendEmail({ to: email, subject, html });
    } catch (emailErr) {
      // Tetap balas generic OK ke client — jangan bocorkan ke user bahwa
      // pengiriman email gagal (juga tidak membedakan dari kasus "email tidak
      // terdaftar"). Log di server untuk diagnosis.
      console.error('[requestPasswordResetAction] Gagal kirim email:', emailErr);
    }

    return GENERIC_OK;
  } catch (err) {
    console.error('[requestPasswordResetAction]', err);
    return GENERIC_OK;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// resetPasswordAction
// Dipanggil dari /reset-password?token=xxx setelah user isi password baru.
// ─────────────────────────────────────────────────────────────────────────────

export async function resetPasswordAction(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ip          = getIP(await headers());
    const rateLimited = await checkResetPasswordLimit(ip);
    if (!rateLimited.success) {
      return { success: false, error: rateLimited.error };
    }

    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'Password minimal 8 karakter.' };
    }
    // Konsisten dengan syarat ganti password di halaman admin (settings.ts).
    if (!/[0-9!@#$%^&*]/.test(newPassword)) {
      return { success: false, error: 'Password harus mengandung minimal 1 angka atau simbol (!@#$%^&*).' };
    }

    const record = await db.passwordReset.findUnique({ where: { token } });

    if (!record) {
      return { success: false, error: 'Link reset tidak valid atau sudah digunakan.' };
    }
    if (record.expiresAt < new Date()) {
      await db.passwordReset.delete({ where: { token } });
      return { success: false, error: 'Link reset sudah kedaluwarsa. Silakan minta link baru.' };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data:  { password: hashedPassword, emailVerified: true },
      });
      // Token sekali pakai — hapus setelah dipakai. Sekalian bersihkan token
      // reset lain milik user ini kalau ada (mis. dua email reset diminta
      // berturut-turut lalu keduanya dibuka).
      await tx.passwordReset.deleteMany({ where: { userId: record.userId } });
    });

    return { success: true };
  } catch (err) {
    console.error('[resetPasswordAction]', err);
    return { success: false, error: 'Terjadi kesalahan. Silakan coba lagi.' };
  }
}
