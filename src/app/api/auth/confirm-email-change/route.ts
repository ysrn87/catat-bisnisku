import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/auth/confirm-email-change?token=xxx
 *
 * Diklik dari email konfirmasi yang dikirim requestEmailChangeAction().
 * Email baru baru benar-benar aktif setelah link ini diklik — sebelum itu
 * user tetap login dengan email lama.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid-token', req.url));
  }

  try {
    const record = await db.emailVerification.findUnique({
      where: { token },
    });

    if (!record || !record.newEmail) {
      return NextResponse.redirect(new URL('/login?error=invalid-token', req.url));
    }

    if (record.expiresAt < new Date()) {
      await db.emailVerification.delete({ where: { token } });
      return NextResponse.redirect(new URL('/login?error=token-expired', req.url));
    }

    // Cek ulang — bisa saja email itu sudah dipakai user lain di antara
    // request dan klik link (race condition kecil tapi tetap perlu dicegah)
    const conflict = await db.user.findFirst({
      where: { email: record.newEmail, NOT: { id: record.userId } },
    });
    if (conflict) {
      await db.emailVerification.delete({ where: { token } });
      return NextResponse.redirect(new URL('/login?error=email-taken', req.url));
    }

    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data:  { email: record.newEmail, emailVerified: true },
      }),
      db.emailVerification.delete({ where: { token } }),
    ]);

    return NextResponse.redirect(new URL('/login?emailChanged=1', req.url));

  } catch (err) {
    console.error('[confirm-email-change]', err);
    return NextResponse.redirect(new URL('/login?error=server-error', req.url));
  }
}
