import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/store/plan
 * Body: { slug: string, plan: 'FREE' | 'PRO', secret: string, days?: number }
 *
 * Endpoint internal untuk upgrade/downgrade plan secara manual.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      slug?:   string;
      plan?:   string;
      secret?: string;
      days?:   number;
    };
    const { slug, plan, secret, days = 30 } = body;

    const expectedSecret = process.env.SUPER_ADMIN_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
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
