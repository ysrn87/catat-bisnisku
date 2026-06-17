import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate limiting utility menggunakan Upstash Redis.
 *
 * Setup:
 *   1. Daftar gratis di https://upstash.com
 *   2. Buat database Redis → copy UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *   3. Tambahkan ke .env
 *
 * Kalau env belum diset, semua request diizinkan (fallback aman untuk development).
 */

function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

// Lazy singleton — hanya dibuat kalau env tersedia
let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

// Lazy limiters
let _loginLimiter:          Ratelimit | null = null;
let _registerStoreLimiter:  Ratelimit | null = null;
let _registerMemberLimiter: Ratelimit | null = null;

function getLoginLimiter(): Ratelimit {
  if (!_loginLimiter) {
    _loginLimiter = new Ratelimit({
      redis:   getRedis(),
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      prefix:  'rl:login',
    });
  }
  return _loginLimiter;
}

function getRegisterStoreLimiter(): Ratelimit {
  if (!_registerStoreLimiter) {
    _registerStoreLimiter = new Ratelimit({
      redis:   getRedis(),
      limiter: Ratelimit.slidingWindow(3, '1 h'),
      prefix:  'rl:register-store',
    });
  }
  return _registerStoreLimiter;
}

function getRegisterMemberLimiter(): Ratelimit {
  if (!_registerMemberLimiter) {
    _registerMemberLimiter = new Ratelimit({
      redis:   getRedis(),
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      prefix:  'rl:register-member',
    });
  }
  return _registerMemberLimiter;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type RateLimitResult =
  | { success: true }
  | { success: false; error: string; retryAfter: number };

// ─── Core check ──────────────────────────────────────────────────────────────

async function checkLimit(
  getLimiter: () => Ratelimit,
  identifier: string
): Promise<RateLimitResult> {
  // Kalau Redis belum dikonfigurasi → izinkan semua (dev mode)
  if (!isRedisConfigured()) {
    return { success: true };
  }

  try {
    const { success, reset } = await getLimiter().limit(identifier);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      const minutes    = Math.ceil(retryAfter / 60);
      return {
        success:    false,
        error:      `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.`,
        retryAfter,
      };
    }

    return { success: true };
  } catch (err) {
    // Kalau Redis error (network issue dll) → jangan block user
    console.error('[ratelimit] Redis error, bypassing:', err);
    return { success: true };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Login: max 5 percobaan per 15 menit per IP */
export async function checkLoginLimit(ip: string): Promise<RateLimitResult> {
  return checkLimit(getLoginLimiter, ip);
}

/** Register toko: max 3 per jam per IP */
export async function checkRegisterStoreLimit(ip: string): Promise<RateLimitResult> {
  return checkLimit(getRegisterStoreLimiter, ip);
}

/** Register member: max 10 per jam per IP */
export async function checkRegisterMemberLimit(ip: string): Promise<RateLimitResult> {
  return checkLimit(getRegisterMemberLimiter, ip);
}

/**
 * Ambil IP dari request headers.
 * Vercel & Railway otomatis set x-forwarded-for.
 */
export function getIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
