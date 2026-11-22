// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT HELPERS
// Dipakai bersama oleh UI kasir (client) dan server action (sales.ts).
// Fungsi di sini MURNI (tanpa DB) sehingga validasi yang sama berjalan di
// browser (umpan balik instan) dan di server (sumber kebenaran).
// ─────────────────────────────────────────────────────────────────────────────

export const PAYMENT_METHODS = [
  { value: 'CASH',     label: 'Tunai'    },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'EWALLET',  label: 'E-Wallet' },
  { value: 'CARD',     label: 'Kartu'    },
  { value: 'QRIS',     label: 'QRIS'     },
] as const;

export type PaymentMethodCode = (typeof PAYMENT_METHODS)[number]['value'];

/** Nilai Payment.method untuk transaksi yang dibayar dengan lebih dari satu metode. */
export const SPLIT_METHOD = 'SPLIT';

/** Batas aman kolom DECIMAL(10,2) di database. */
export const MAX_PAYMENT_AMOUNT = 99_999_999;

export function isPaymentMethod(value: string): value is PaymentMethodCode {
  return PAYMENT_METHODS.some((m) => m.value === value);
}

/** Kode lama yang mungkin masih ada di data historis → kode baku. */
const LEGACY_ALIASES: Record<string, PaymentMethodCode> = {
  TUNAI:  'CASH',
  BANK:   'TRANSFER',
  DEBIT:  'CARD',
  KREDIT: 'CARD',
};

/** Ubah input bebas (huruf kecil, kode lama) ke kode baku; null bila tidak dikenali. */
export function normalizePaymentMethod(value: unknown): PaymentMethodCode | null {
  const upper = String(value ?? '').toUpperCase().trim();
  if (isPaymentMethod(upper)) return upper;
  return LEGACY_ALIASES[upper] ?? null;
}

/** Label tampilan untuk kode metode (termasuk SPLIT dan kode lama). */
export function paymentMethodLabel(code: string | null | undefined): string {
  if (!code) return '-';
  const upper = code.toUpperCase().trim();
  if (upper === SPLIT_METHOD) return 'Split';
  const normalized = normalizePaymentMethod(upper);
  return normalized ? PAYMENT_METHODS.find((m) => m.value === normalized)!.label : code;
}

function rp(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

/** Pembulatan 2 desimal yang stabil untuk uang (hindari 0.1 + 0.2). */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ─── Tipe ────────────────────────────────────────────────────────────────────

/** Satu baris pembayaran yang dikirim kasir. */
export interface PaymentLineInput {
  method: string;
  /** Nilai yang DIPAKAI untuk melunasi transaksi lewat metode ini. */
  amount: number;
  /** Hanya untuk CASH: uang fisik yang diterima dari pelanggan. */
  cashReceived?: number;
}

/** Baris pembayaran yang sudah divalidasi dan siap disimpan/dijurnal. */
export interface NormalizedPaymentLine {
  method: PaymentMethodCode;
  amount: number;
  cashReceived: number | null;
  changeAmount: number | null;
}

export type PaymentValidation =
  | { ok: true; lines: NormalizedPaymentLine[]; method: string; cashReceived: number | null; changeAmount: number | null }
  | { ok: false; error: string };

// ─── Validasi ────────────────────────────────────────────────────────────────

/**
 * Validasi pembayaran LUNAS terhadap total transaksi.
 *
 * Aturan:
 *  - total 0 (mis. 100% diskon/poin) → tidak butuh baris pembayaran.
 *  - total > 0 → minimal satu baris; jumlah `amount` semua baris HARUS = total.
 *  - tiap metode maksimal satu baris (split memakai metode berbeda).
 *  - CASH: `cashReceived` wajib ≥ `amount`; selisihnya = kembalian.
 *  - non-CASH: tidak ada uang diterima/kembalian (dibayar pas).
 */
export function validatePaidPayments(lines: PaymentLineInput[], total: number): PaymentValidation {
  const grand = roundMoney(total);

  if (grand <= 0) {
    return { ok: true, lines: [], method: 'CASH', cashReceived: null, changeAmount: null };
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, error: 'Pilih metode pembayaran' };
  }
  if (lines.length > PAYMENT_METHODS.length) {
    return { ok: false, error: 'Terlalu banyak metode pembayaran' };
  }

  const seen = new Set<string>();
  const normalized: NormalizedPaymentLine[] = [];

  for (const raw of lines) {
    const method = normalizePaymentMethod(raw?.method);
    if (!method) return { ok: false, error: 'Metode pembayaran tidak valid' };
    if (seen.has(method)) return { ok: false, error: `Metode ${paymentMethodLabel(method)} dipakai lebih dari sekali` };
    seen.add(method);

    const amount = roundMoney(Number(raw.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: `Nominal ${paymentMethodLabel(method)} harus lebih dari 0` };
    }
    if (amount > MAX_PAYMENT_AMOUNT) return { ok: false, error: 'Nominal pembayaran terlalu besar' };

    if (method === 'CASH') {
      const received = raw.cashReceived === undefined || raw.cashReceived === null
        ? amount // tidak dikirim → dianggap uang pas (kompatibel dengan form lama)
        : roundMoney(Number(raw.cashReceived));
      if (!Number.isFinite(received) || received < 0) return { ok: false, error: 'Nominal uang diterima tidak valid' };
      if (received > MAX_PAYMENT_AMOUNT) return { ok: false, error: 'Nominal uang diterima terlalu besar' };
      if (received < amount) {
        return { ok: false, error: `Uang tunai yang diterima kurang ${rp(amount - received)}` };
      }
      normalized.push({ method, amount, cashReceived: received, changeAmount: roundMoney(received - amount) });
    } else {
      normalized.push({ method, amount, cashReceived: null, changeAmount: null });
    }
  }

  const paid = roundMoney(normalized.reduce((s, l) => s + l.amount, 0));
  if (paid !== grand) {
    return {
      ok: false,
      error: paid < grand
        ? `Pembayaran kurang ${rp(grand - paid)}`
        : `Pembayaran lebih ${rp(paid - grand)}`,
    };
  }

  const cashLine = normalized.find((l) => l.method === 'CASH');
  return {
    ok: true,
    lines: normalized,
    method: normalized.length > 1 ? SPLIT_METHOD : normalized[0].method,
    cashReceived: cashLine?.cashReceived ?? null,
    changeAmount: cashLine?.changeAmount ?? null,
  };
}

// ─── Saran nominal tunai (tombol cepat di kasir) ─────────────────────────────

const CASH_STEPS = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000];

/**
 * Saran uang diterima: pecahan pembulatan ke atas dari `amount`
 * (mis. 37.500 → 38.000, 40.000, 50.000, 100.000). Tidak termasuk "uang pas".
 */
export function suggestCashAmounts(amount: number, max = 4): number[] {
  if (!Number.isFinite(amount) || amount <= 0) return [];
  const out = new Set<number>();
  for (const step of CASH_STEPS) {
    const up = Math.ceil(amount / step) * step;
    if (up > amount && up <= MAX_PAYMENT_AMOUNT) out.add(up);
  }
  return [...out].sort((a, b) => a - b).slice(0, max);
}
