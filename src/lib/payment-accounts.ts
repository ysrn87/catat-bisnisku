// ─────────────────────────────────────────────────────────────────────────────
// STORE PAYMENT ACCOUNTS — helper murni (tanpa DB)
// Dipakai bersama oleh server action, halaman pengaturan, dialog kasir, dan invoice.
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentAccountType = 'BANK' | 'EWALLET' | 'QRIS';

/** Bentuk data yang dikirim ke UI (tanpa storeId & timestamp). */
export interface PaymentAccountInfo {
  id:            string;
  type:          PaymentAccountType;
  provider:      string;
  accountNumber: string | null;
  accountName:   string | null;
  qrisImageUrl:  string | null;
  isActive:      boolean;
}

export const PAYMENT_ACCOUNT_TYPES: PaymentAccountType[] = ['BANK', 'EWALLET', 'QRIS'];

export const PAYMENT_ACCOUNT_TYPE_LABEL: Record<PaymentAccountType, string> = {
  BANK:    'Rekening Bank',
  EWALLET: 'E-Wallet',
  QRIS:    'QRIS',
};

/** Batas per toko untuk tiap tipe (mencegah daftar membengkak di invoice). */
export const MAX_ACCOUNTS_PER_TYPE: Record<PaymentAccountType, number> = {
  BANK:    10,
  EWALLET: 10,
  QRIS:    3,
};

export const BANK_SUGGESTIONS = [
  'BCA', 'BRI', 'BNI', 'Mandiri', 'BSI', 'CIMB Niaga', 'Permata', 'Danamon',
  'BTN', 'Bank Jago', 'SeaBank', 'Jenius (BTPN)', 'OCBC', 'Panin',
];

export const EWALLET_SUGGESTIONS = ['DANA', 'OVO', 'GoPay', 'ShopeePay', 'LinkAja'];

/** Metode pembayaran kasir → tipe rekening yang ditampilkan. */
export function accountTypeForMethod(method: string): PaymentAccountType | null {
  switch (method.toUpperCase().trim()) {
    case 'TRANSFER': return 'BANK';
    case 'EWALLET':  return 'EWALLET';
    case 'QRIS':     return 'QRIS';
    default:         return null;
  }
}

/** Akun aktif & layak tampil untuk satu tipe (QRIS tanpa gambar disembunyikan). */
export function displayableAccounts(accounts: PaymentAccountInfo[], type: PaymentAccountType): PaymentAccountInfo[] {
  return accounts.filter((a) => {
    if (a.type !== type || !a.isActive) return false;
    if (type === 'QRIS') return !!a.qrisImageUrl;
    return !!a.accountNumber;
  });
}

// ─── Warna badge e-wallet (dipakai di UI dan invoice) ────────────────────────

const EWALLET_COLORS: Record<string, string> = {
  dana:      '#108de0',
  gopay:     '#00aed6',
  ovo:       '#4c3494',
  shopeepay: '#ee4d2d',
  linkaja:   '#e82529',
};

export function ewalletColor(provider: string): string {
  const key = provider.toLowerCase().replace(/[^a-z]/g, '');
  return EWALLET_COLORS[key] ?? '#475569';
}

// ─── Validasi input (dipakai di client dan server) ───────────────────────────

export interface PaymentAccountInput {
  type:          PaymentAccountType;
  provider:      string;
  accountNumber: string;
  accountName:   string;
}

export type PaymentAccountValidation =
  | { ok: true;  value: { provider: string; accountNumber: string | null; accountName: string | null } }
  | { ok: false; error: string };

const collapse = (v: string) => v.replace(/\s+/g, ' ').trim();

export function validatePaymentAccountInput(input: PaymentAccountInput): PaymentAccountValidation {
  if (!PAYMENT_ACCOUNT_TYPES.includes(input.type)) {
    return { ok: false, error: 'Tipe akun tidak valid.' };
  }

  const provider = collapse(String(input.provider ?? ''));
  const number   = collapse(String(input.accountNumber ?? ''));
  const name     = collapse(String(input.accountName ?? ''));

  if (input.type === 'QRIS') {
    // Untuk QRIS, provider hanyalah label tampilan (opsional).
    if (provider.length > 40) return { ok: false, error: 'Label QRIS maksimal 40 karakter.' };
    return { ok: true, value: { provider: provider || 'QRIS', accountNumber: null, accountName: null } };
  }

  const label = input.type === 'BANK' ? 'Nama bank' : 'Nama e-wallet';
  if (provider.length < 2 || provider.length > 40) {
    return { ok: false, error: `${label} wajib diisi (2–40 karakter).` };
  }

  // Angka, spasi, dan tanda hubung (agar mudah dibaca: 5082 0101 7374 508 / 0823-3131-2555).
  if (!/^[0-9][0-9 -]{3,29}$/.test(number)) {
    return {
      ok: false,
      error: input.type === 'BANK'
        ? 'No. rekening hanya boleh berisi angka, spasi, atau tanda hubung (4–30 karakter).'
        : 'Nomor e-wallet hanya boleh berisi angka, spasi, atau tanda hubung (4–30 karakter).',
    };
  }

  if (name.length < 2 || name.length > 60) {
    return { ok: false, error: 'Atas nama wajib diisi (2–60 karakter).' };
  }

  return { ok: true, value: { provider, accountNumber: number, accountName: name } };
}

// ─── Gambar QRIS ─────────────────────────────────────────────────────────────

export const QRIS_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
export const QRIS_ALLOWED_MIME   = ['image/jpeg', 'image/png', 'image/webp'];
export const QRIS_BLOB_PREFIX    = 'store-qris';
export const BLOB_HOST_SUFFIX    = '.public.blob.vercel-storage.com';

/** Hanya URL https dari Vercel Blob yang boleh dirender sebagai gambar QRIS. */
export function isSafeBlobUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}
