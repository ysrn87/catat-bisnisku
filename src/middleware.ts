import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

// ─── Route publik — tidak butuh session ───────────────────────────────────────
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/register-store',
  '/unauthorized',
  '/offline',
  '/api/auth',
  '/api/store',   // internal API — skip auth di middleware
];

// ─── Route yang butuh session tapi tidak butuh store context ──────────────────
const AUTH_ONLY_ROUTES = [
  '/store-select',
];

// ─── File statis ──────────────────────────────────────────────────────────────
const STATIC_EXT = /\.(?:ico|png|jpg|jpeg|svg|gif|webp|css|js|woff2?|ttf|map)$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip: next internals & statis
  if (
    STATIC_EXT.test(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  // Skip: route publik
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next();
  }

  // ─── Cek session ──────────────────────────────────────────────────────────
  const session = await auth();

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ─── Auth-only routes ─────────────────────────────────────────────────────
  if (AUTH_ONLY_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next();
  }

  // ─── Extract slug dari path ───────────────────────────────────────────────
  // Pattern: /[slug]/admin/..., /[slug]/manager/..., /[slug]/member/..., /[slug]/upgrade
  const slugMatch = pathname.match(/^\/([^/]+)\/(admin|manager|member|upgrade)(\/|$)/);

  if (!slugMatch) {
    return NextResponse.next();
  }

  const slug = slugMatch[1];

  // Inject slug ke header — layout yang akan query DB untuk resolve storeId
  // Ini menghindari masalah Prisma/fetch di edge runtime middleware
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-store-slug', slug);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
