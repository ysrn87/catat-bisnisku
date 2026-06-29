import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { sendEmail, getAppUrl, emailVerificationTemplate } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where:  { email: email.toLowerCase() },
      select: { id: true, name: true, emailVerified: true },
    });

    // Selalu kembalikan 200 agar tidak membocorkan apakah email terdaftar
    if (!user || user.emailVerified) {
      return NextResponse.json({ success: true });
    }

    // Hapus token lama jika ada
    await db.emailVerification.deleteMany({ where: { userId: user.id } });

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.emailVerification.create({
      data: { userId: user.id, token, expiresAt },
    });

    const verifyLink = `${getAppUrl()}/api/auth/verify-email?token=${token}`;
    const { subject, html } = emailVerificationTemplate({ name: user.name, link: verifyLink });
    await sendEmail({ to: email, subject, html });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[resend-verification]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan.' }, { status: 500 });
  }
}
