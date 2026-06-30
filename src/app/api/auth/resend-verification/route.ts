import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { headers } from 'next/headers';
import { sendEmail, getAppUrl, emailVerificationTemplate } from '@/lib/email';
import { checkResendVerificationLimit, getIP } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();

    // FIX: rate limit dicek SEBELUM lookup user, dan pakai pesan generik yang
    // sama persis dengan kasus "email tidak ada/sudah verified" di bawah.
    // Kalau pesan rate-limit berbeda dari pesan sukses, penyerang bisa
    // membedakan "email ini ada di database" (kena limit setelah beberapa
    // kali coba) dari "email ini tidak ada" (selalu sukses) — membocorkan
    // keberadaan akun walau responsnya sengaja dibuat seragam di bawah.
    const ip          = getIP(await headers());
    const rateLimited = await checkResendVerificationLimit(normalizedEmail, ip);
    if (!rateLimited.success) {
      return NextResponse.json({ success: true });
    }

    const user = await db.user.findUnique({
      where:  { email: normalizedEmail },
      select: { id: true, name: true, emailVerified: true },
    });

    // Selalu kembalikan 200 agar tidak membocorkan apakah email terdaftar
    if (!user || user.emailVerified) {
      return NextResponse.json({ success: true });
    }

    // Hapus token verifikasi-awal lama jika ada (newEmail: null) — tidak
    // menyentuh token ganti-email (newEmail terisi) milik user yang sama,
    // karena itu request yang berbeda dan punya alur expiry sendiri.
    await db.emailVerification.deleteMany({ where: { userId: user.id, newEmail: null } });

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.emailVerification.create({
      data: { userId: user.id, token, expiresAt },
    });

    const verifyLink = `${getAppUrl()}/api/auth/verify-email?token=${token}`;
    const { subject, html } = emailVerificationTemplate({ name: user.name, link: verifyLink });
    await sendEmail({ to: normalizedEmail, subject, html });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[resend-verification]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan.' }, { status: 500 });
  }
}
