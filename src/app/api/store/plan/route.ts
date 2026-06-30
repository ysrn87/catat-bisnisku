import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { headers } from 'next/headers';
import { checkAdminPlanSecretLimit, getIP } from '@/lib/ratelimit';

/**
 * Perbandingan secret yang aman dari timing attack.
 * crypto.timingSafeEqual() melempar error kalau panjang buffer berbeda,
 * jadi kita samakan panjang lebih dulu dengan hash SHA-256 — hasilnya
 * selalu 32 byte berapa pun panjang input aslinya, sehingga perbandingan
 * tetap berjalan walau `secret` yang dikirim attacker jauh lebih
 * pendek/panjang dari secret asli (skenario itu sebelumnya langsung
 * gagal di awal lewat `!==`, membocorkan info "panjang tidak cocok"
 * lewat pola request yang berbeda).
 */
function secretsMatch(provided: string, expected: string): boolean {
  const providedHash = crypto.createHash('sha256').update(provided).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

/**
 * POST /api/store/plan
 * Body: { slug: string, plan: 'FREE' | 'PRO', secret: string, days?: number }
 *
 * Endpoint internal untuk upgrade/downgrade plan secara manual.
 */
export async function POST(request: NextRequest) {
  try {
    // FIX: rate limit di paling awal, sebelum parse body sekalipun —
    // endpoint ini di-skip dari auth check middleware (lihat middleware.ts,
    // '/api/store' sengaja dikecualikan untuk internal tooling), jadi
    // satu-satunya pertahanan adalah secret + limit ini.
    const ip          = getIP(await headers());
    const rateLimited = await checkAdminPlanSecretLimit(ip);
    if (!rateLimited.success) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
    }

    const body = await request.json() as {
      slug?:   string;
      plan?:   string;
      secret?: string;
      days?:   number;
    };
    const { slug, plan, secret, days = 30 } = body;

    const expectedSecret = process.env.SUPER_ADMIN_SECRET;
    // FIX: !== diganti secretsMatch() — constant-time, tidak bocorkan info
    // lewat timing meski secret yang dikirim attacker hampir benar.
    if (!expectedSecret || !secret || !secretsMatch(secret, expectedSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!slug)                             return NextResponse.json({ error: 'slug is required' },        { status: 400 });
    if (plan !== 'FREE' && plan !== 'PRO') return NextResponse.json({ error: 'plan must be FREE or PRO' }, { status: 400 });

    const store = await db.store.findUnique({ where: { slug } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    // FIX: subscriptionExpiresAt → planExpiresAt
    let planExpiresAt: Date | null = null;
    if (plan === 'PRO') {
      const base =
        store.planExpiresAt && store.planExpiresAt > new Date()
          ? store.planExpiresAt
          : new Date();
      planExpiresAt = new Date(base);
      planExpiresAt.setDate(planExpiresAt.getDate() + days);
    }

    const updated = await db.store.update({
      where: { slug },
      data: {
        plan: plan as 'FREE' | 'PRO',
        planExpiresAt, // FIX: subscriptionExpiresAt → planExpiresAt
        updatedAt: new Date(),
      },
      select: { id: true, name: true, slug: true, plan: true, planExpiresAt: true },
    });

    return NextResponse.json({
      success: true,
      store:   updated,
      message: plan === 'PRO'
        ? `Store "${updated.name}" berhasil upgrade ke PRO sampai ${planExpiresAt?.toLocaleDateString('id-ID')}`
        : `Store "${updated.name}" berhasil downgrade ke FREE`,
    });

  } catch (error) {
    console.error('Update plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
