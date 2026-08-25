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
let _loginLimiter:             Ratelimit | null = null;
let _registerStoreLimiter:     Ratelimit | null = null;
let _registerMemberLimiter:    Ratelimit | null = null;
let _resendVerificationLimiter: Ratelimit | null = null;
let _inviteStaffLimiter:       Ratelimit | null = null;
let _registerFromInvitationLimiter: Ratelimit | null = null;
let _joinStoreLimiter:         Ratelimit | null = null;
let _adminPlanSecretLimiter:   Ratelimit | null = null;
let _logoUploadLimiter:        Ratelimit | null = null;

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

function getResendVerificationLimiter(): Ratelimit {
  if (!_resendVerificationLimiter) {
    _resendVerificationLimiter = new Ratelimit({
      redis:   getRedis(),
      limiter: Ratelimit.slidingWindow(3, '15 m'),
      prefix:  'rl:resend-verification',
    });
  }
  return _resendVerificationLimiter;
}

function getInviteStaffLimiter(): Ratelimit {
  if (!_inviteStaffLimiter) {
    _inviteStaffLimiter = new Ratelimit({
      redis:   getRedis(),
      limiter: Ratelimit.slidingWindow(20, '1 h'),
      prefix:  'rl:invite-staff',
    });
  }
  return _inviteStaffLimiter;
}

function getRegisterFromInvitationLimiter(): Ratelimit {
  if (!_registerFromInvitationLimiter) {
    _registerFromInvitationLimiter = new Ratelimit({
      redis:   getRedis(),
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      prefix:  'rl:register-invitation',
    });
  }
  return _registerFromInvitationLimiter;
}

function getJoinStoreLimiter(): Ratelimit {
  if (!_joinStoreLimiter) {
    _joinStoreLimiter = new Ratelimit({
      redis:   getRedis(),
      limiter: Ratelimit.slidingWindow(10, '10 m'),
      prefix:  'rl:join-store',
    });
  }
  return _joinStoreLimiter;
}

function getAdminPlanSecretLimiter(): Ratelimit {
  if (!_adminPlanSecretLimiter) {
    _adminPlanSecretLimiter = new Ratelimit({
      redis:   getRedis(),
      // Sengaja ketat — endpoint ini cuma dipanggil manual oleh pemilik,
      // jadi traffic sah seharusnya sangat jarang. 5 percobaan / jam per IP
      // cukup untuk human error, terlalu sedikit untuk brute-force secret.
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      prefix:  'rl:admin-plan-secret',
    });
  }
  return _adminPlanSecretLimiter;
}

function getLogoUploadLimiter(): Ratelimit {
  if (!_logoUploadLimiter) {
    _logoUploadLimiter = new Ratelimit({
      redis:   getRedis(),
      // Upload logo legitimate jarang lebih dari beberapa kali per sesi
      // ganti branding. 10/jam cukup longgar untuk coba-coba beberapa
      // desain, terlalu sempit untuk dipakai membengkakkan Blob storage.
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      prefix:  'rl:logo-upload',
    });
  }
  return _logoUploadLimiter;
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
 * Resend verification: max 3 per 15 menit, dicek per EMAIL dan per IP.
 * Dua identifier sekaligus karena email bombing ke satu korban bisa datang
 * dari banyak IP berbeda (proxy/VPN), tapi kita juga tidak mau satu IP
 * memicu resend untuk banyak email berbeda secara berturut-turut.
 */
export async function checkResendVerificationLimit(email: string, ip: string): Promise<RateLimitResult> {
  const byEmail = await checkLimit(getResendVerificationLimiter, `email:${email}`);
  if (!byEmail.success) return byEmail;
  return checkLimit(getResendVerificationLimiter, `ip:${ip}`);
}

/** Undang staff: max 20 undangan per jam per user yang mengundang */
export async function checkInviteStaffLimit(inviterUserId: string): Promise<RateLimitResult> {
  return checkLimit(getInviteStaffLimiter, inviterUserId);
}

/** Registrasi via link undangan staff: max 10 per jam per IP */
export async function checkRegisterFromInvitationLimit(ip: string): Promise<RateLimitResult> {
  return checkLimit(getRegisterFromInvitationLimiter, ip);
}

/** Join toko sebagai member: max 10 per 10 menit per user yang join */
export async function checkJoinStoreLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(getJoinStoreLimiter, userId);
}

/** Endpoint admin /api/store/plan: max 5 percobaan per jam per IP */
export async function checkAdminPlanSecretLimit(ip: string): Promise<RateLimitResult> {
  return checkLimit(getAdminPlanSecretLimiter, ip);
}

/** Upload logo toko: max 10 per jam per user yang upload */
export async function checkLogoUploadLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(getLogoUploadLimiter, userId);
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
