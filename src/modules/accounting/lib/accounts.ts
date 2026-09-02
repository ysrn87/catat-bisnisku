// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT CHART OF ACCOUNTS
// Seed saat toko baru dibuat. Relevan untuk SME retail Indonesia.
// ─────────────────────────────────────────────────────────────────────────────

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface DefaultAccount {
  code: string;
  name: string;
  type: AccountType;
  isSystem: boolean; // system accounts tidak boleh dihapus
}

export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccount[] = [
  // ── ASET (1xxx) ──────────────────────────────────────────────────────────
  { code: '1001', name: 'Kas',                    type: 'ASSET',     isSystem: true  },
  { code: '1002', name: 'Bank',                   type: 'ASSET',     isSystem: false },
  { code: '1003', name: 'Piutang Dagang',          type: 'ASSET',     isSystem: true  },
  { code: '1004', name: 'Persediaan Barang',       type: 'ASSET',     isSystem: true  },
  { code: '1005', name: 'Perlengkapan',            type: 'ASSET',     isSystem: false },

  // ── LIABILITAS (2xxx) ────────────────────────────────────────────────────
  { code: '2001', name: 'Utang Dagang',            type: 'LIABILITY', isSystem: true  },
  { code: '2002', name: 'Utang Bank',              type: 'LIABILITY', isSystem: false },

  // ── EKUITAS (3xxx) ───────────────────────────────────────────────────────
  { code: '3001', name: 'Modal Pemilik',           type: 'EQUITY',    isSystem: true  },
  { code: '3002', name: 'Prive',                   type: 'EQUITY',    isSystem: false },

  // ── PENDAPATAN (4xxx) ────────────────────────────────────────────────────
  { code: '4001', name: 'Pendapatan Penjualan',    type: 'REVENUE',   isSystem: true  },
  { code: '4002', name: 'Pendapatan Lain-lain',    type: 'REVENUE',   isSystem: false },

  // ── BEBAN (5xxx) ─────────────────────────────────────────────────────────
  { code: '5001', name: 'HPP',                     type: 'EXPENSE',   isSystem: true  },
  { code: '5002', name: 'Beban Gaji',              type: 'EXPENSE',   isSystem: false },
  { code: '5003', name: 'Beban Sewa',              type: 'EXPENSE',   isSystem: false },
  { code: '5004', name: 'Beban Utilitas',          type: 'EXPENSE',   isSystem: false }, // listrik, air
  { code: '5005', name: 'Beban Transportasi',      type: 'EXPENSE',   isSystem: false },
  { code: '5006', name: 'Beban Bahan Baku',        type: 'EXPENSE',   isSystem: false },
  { code: '5007', name: 'Beban Marketing',         type: 'EXPENSE',   isSystem: false },
  { code: '5008', name: 'Beban Operasional Lain',  type: 'EXPENSE',   isSystem: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// CASHFLOW CATEGORY → ACCOUNT CODE MAPPING
// Menghubungkan kategori cashflow user dengan akun akuntansi sistem
// ─────────────────────────────────────────────────────────────────────────────

// Metode pembayaran → kode akun kas/bank
export const PAYMENT_METHOD_TO_ACCOUNT: Record<string, string> = {
  CASH:        '1001', // Kas
  TUNAI:       '1001',
  TRANSFER:    '1002', // Bank
  BANK:        '1002',
  QRIS:        '1002',
  DEBIT:       '1002',
  KREDIT:      '1002',
};

// Default ke Kas jika metode tidak dikenali
export function resolvePaymentAccount(method: string): string {
  const normalized = method.toUpperCase().trim();
  return PAYMENT_METHOD_TO_ACCOUNT[normalized] ?? '1001';
}

// Kategori pengeluaran cashflow → kode akun beban
export const EXPENSE_CATEGORY_TO_ACCOUNT: Record<string, string> = {
  'Bahan Baku':   '5006',
  'Operasional':  '5008',
  'Gaji':         '5002',
  'Sewa':         '5003',
  'Utilitas':     '5004',
  'Listrik':      '5004',
  'Air':          '5004',
  'Internet':     '5004',
  'Transportasi': '5005',
  'Marketing':    '5007',
  'Iklan':        '5007',
  'Lainnya':      '5008',
};

// Kategori pemasukan cashflow → kode akun pendapatan/ekuitas
export const INCOME_CATEGORY_TO_ACCOUNT: Record<string, string> = {
  'Penjualan':      '4001',
  'Investasi':      '3001', // tambah modal
  'Modal':          '3001',
  'Pinjaman':       '2002', // utang bank
  'Piutang Diterima': '1003',
  'Lainnya':        '4002',
};

export function resolveExpenseAccount(category: string): string {
  return EXPENSE_CATEGORY_TO_ACCOUNT[category] ?? '5008';
}

export function resolveIncomeAccount(category: string): string {
  return INCOME_CATEGORY_TO_ACCOUNT[category] ?? '4002';
}
