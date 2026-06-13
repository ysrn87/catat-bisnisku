import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/store/resolve?slug=[slug]
 *
 * Internal API dipanggil oleh middleware untuk resolve slug → storeId.
 * Dilindungi oleh header x-internal-request.
 * Hasilnya di-cache 60 detik agar tidak hit DB di setiap request.
 */
export async function GET(request: NextRequest) {
  // Guard: hanya boleh dipanggil dari middleware (internal)
  const internalSecret = request.headers.get('x-internal-request');
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? 'internal';

  if (internalSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const slug = request.nextUrl.searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  const store = await db.store.findUnique({
    where: { slug },
    select: { id: true, plan: true, slug: true, name: true },
  });

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  return NextResponse.json(
    { storeId: store.id, plan: store.plan, slug: store.slug, name: store.name },
    {
      headers: {
        // Cache di edge 60 detik — slug tidak sering berubah
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
      },
    }
  );
}
