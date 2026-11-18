// Konstanta & tipe batas paket. Sengaja TANPA import server-only
// agar aman dipakai di client component (form superadmin).

export const LIMIT_KEYS = ['products', 'variantsPerProduct', 'managers', 'cashiers'] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];

/** Nilai di DB yang berarti "tak terbatas". */
export const UNLIMITED = -1;

/** Nilai mentah di DB: null = ikut level berikutnya, -1 = tak terbatas, >= 1 = batas. */
export type RawLimits = Record<LimitKey, number | null>;
/** Batas efektif: Infinity = tak terbatas. */
export type EffectiveLimits = Record<LimitKey, number>;

export const MAX_LIMIT_VALUE = 1_000_000;

export const LIMIT_LABELS: Record<LimitKey, string> = {
  products:           'Produk',
  variantsPerProduct: 'Varian per produk',
  managers:           'Manager',
  cashiers:           'Kasir',
};

export function formatLimit(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'Ikut default';
  if (n === UNLIMITED || n === Infinity) return 'Tak terbatas';
  return n.toLocaleString('id-ID');
}
