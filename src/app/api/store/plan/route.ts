import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/store/plan
 * Body: { slug: string, plan: 'FREE' | 'PRO', secret: string }
 *
 * Endpoint internal untuk upgrade/downgrade plan secara manual.
 * Dilindungi oleh SUPER_ADMIN_SECRET di environment variable.
 *
 * Nanti bisa diganti dengan integrasi payment gateway (Midtrans/Xendit).
 *
 * Contoh:
 *   curl -X POST https://catatbisnisku.com/api/store/plan \
 *     -H "Content-Type: application/json" \
 *     -d '{"slug":"toko-budi","plan":"PRO","secret":"your-secret"}'
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { slug?: string; plan?: string; secret?: string };
    const { slug, plan, secret } = body;

    // Guard: hanya dengan secret yang benar
    const expectedSecret = process.env.SUPER_ADMIN_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!slug)                             return NextResponse.json({ error: 'slug is required' },       { status: 400 });
    if (plan !== 'FREE' && plan !== 'PRO') return NextResponse.json({ error: 'plan must be FREE or PRO' }, { status: 400 });

    const store = await db.store.findUnique({ where: { slug } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const updated = await db.store.update({
      where: { slug },
      data:  { plan: plan as 'FREE' | 'PRO', updatedAt: new Date() },
      select: { id: true, name: true, slug: true, plan: true },
    });

    return NextResponse.json({
      success: true,
      store: updated,
      message: `Store "${updated.name}" berhasil diupdate ke plan ${plan}`,
    });

  } catch (error) {
    console.error('Update plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
