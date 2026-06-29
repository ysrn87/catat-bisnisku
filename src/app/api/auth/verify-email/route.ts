import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid-token', req.url));
  }

  try {
    const record = await db.emailVerification.findUnique({
      where:   { token },
      include: { user: { select: { id: true, emailVerified: true } } },
    });

    if (!record) {
      return NextResponse.redirect(new URL('/login?error=invalid-token', req.url));
    }

    if (record.expiresAt < new Date()) {
      await db.emailVerification.delete({ where: { token } });
      return NextResponse.redirect(new URL('/login?error=token-expired', req.url));
    }

    if (record.user.emailVerified) {
      // Sudah diverifikasi sebelumnya — langsung ke login
      await db.emailVerification.delete({ where: { token } });
      return NextResponse.redirect(new URL('/login?verified=1', req.url));
    }

    // Verifikasi berhasil
    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data:  { emailVerified: true },
      }),
      db.emailVerification.delete({ where: { token } }),
    ]);

    return NextResponse.redirect(new URL('/login?verified=1', req.url));

  } catch (err) {
    console.error('[verify-email]', err);
    return NextResponse.redirect(new URL('/login?error=server-error', req.url));
  }
}
