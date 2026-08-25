import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth.edge';

// ─── Route publik — tidak butuh session ───────────────────────────────────────
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/register-store',
  '/forgot-password',
  '/reset-password',
  '/unauthorized',
  '/offline',
  '/api/auth',
  '/api/store',   // internal API — skip auth di middleware
  '/api/midtrans',  // webhook dari server Midtrans
];

// ─── Route yang butuh session tapi tidak butuh store context ──────────────────
const AUTH_ONLY_ROUTES = [
  '/store-select',
  '/member-select',
  '/join-store',
];

// ─── File statis ──────────────────────────────────────────────────────────────
const STATIC_EXT = /\.(?:ico|png|jpg|jpeg|svg|gif|webp|css|js|json|woff2?|ttf|map)$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip: next internals, statis, dan PWA files
  if (
    STATIC_EXT.test(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/workbox-')
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
  // Pattern: /[slug]/admin/..., /[slug]/manager/..., /[slug]/cashier/..., /[slug]/member/..., /[slug]/upgrade
  const slugMatch = pathname.match(/^\/([^/]+)\/(admin|manager|cashier|member|upgrade)(\/|$)/);

  if (!slugMatch) {
    return NextResponse.next();
  }

  const slug = slugMatch[1];

  // Validasi format slug — hanya boleh a-z, 0-9, dash, panjang 3-50
  // Cegah path traversal dan karakter berbahaya di header
  const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
  if (!SLUG_REGEX.test(slug)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-store-slug', slug);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};