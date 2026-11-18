import { createHmac, randomInt, timingSafeEqual } from 'crypto';

const TTL_MS = 10 * 60 * 1000; // 10 menit

const WORDS = [
  'apel', 'bukit', 'cahaya', 'damai', 'elang', 'fajar', 'gunung', 'hujan',
  'jeruk', 'kancil', 'lampu', 'mawar', 'nanas', 'ombak', 'pelangi', 'rembulan',
  'sungai', 'tebing', 'udara', 'vanila', 'wangi', 'zaitun', 'angsa', 'batu',
  'cemara', 'dermaga', 'embun', 'gandum', 'harimau', 'iklim', 'jagung', 'kapal',
  'layang', 'madu', 'nelayan', 'oasis', 'pantai', 'rusa', 'senja', 'teratai',
  'ayam', 'biru', 'cabai', 'domba', 'emas', 'fosil', 'garam', 'hijau',
  'ikan', 'jahe', 'kelapa', 'lilin', 'merak', 'nasi', 'padi', 'roti',
  'sapi', 'tomat', 'ubi', 'warna', 'bambu', 'dadu', 'kopi', 'teh',
];

function getSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 32) throw new Error('[delete-store] NEXTAUTH_SECRET tidak valid');
  return s;
}

function sign(payload: string): Buffer {
  return createHmac('sha256', getSecret()).update(`delete-store:${payload}`).digest();
}

/** Samakan huruf besar/kecil dan spasi supaya mudah diketik di HP. */
export function normalizePhrase(v: string): string {
  return v.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function pickPhrase(wordCount = 4): string {
  const chosen: string[] = [];
  while (chosen.length < wordCount) {
    const w = WORDS[randomInt(WORDS.length)];
    if (!chosen.includes(w)) chosen.push(w);
  }
  return chosen.join(' ');
}

/** Token stateless: terikat ke user + toko, berisi kalimat, kedaluwarsa 10 menit. */
export function createDeleteStoreChallenge(userId: string, storeId: string): { phrase: string; token: string } {
  const phrase  = pickPhrase();
  const payload = Buffer.from(JSON.stringify({ u: userId, s: storeId, p: phrase, e: Date.now() + TTL_MS })).toString('base64url');
  const token   = `${payload}.${sign(payload).toString('base64url')}`;
  return { phrase, token };
}

export type ChallengeVerification =
  | { ok: true }
  | { ok: false; reason: 'INVALID' | 'EXPIRED' | 'MISMATCH' };

export function verifyDeleteStoreChallenge(
  token: string,
  userId: string,
  storeId: string,
  typedPhrase: string
): ChallengeVerification {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'INVALID' };
  const [payload, sig] = parts;

  const expected = sign(payload);
  let given: Buffer;
  try {
    given = Buffer.from(sig, 'base64url');
  } catch {
    return { ok: false, reason: 'INVALID' };
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'INVALID' };
  }

  let data: { u?: string; s?: string; p?: string; e?: number };
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'INVALID' };
  }

  if (data.u !== userId || data.s !== storeId || typeof data.p !== 'string' || typeof data.e !== 'number') {
    return { ok: false, reason: 'INVALID' };
  }
  if (Date.now() > data.e) return { ok: false, reason: 'EXPIRED' };
  if (normalizePhrase(typedPhrase) !== normalizePhrase(data.p)) return { ok: false, reason: 'MISMATCH' };

  return { ok: true };
}
