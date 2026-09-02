// ─────────────────────────────────────────────────────────────────────────────
// JOURNAL ENGINE
// Mengubah transaksi bisnis (POS sale, cashflow manual) menjadi
// double-entry journal entries secara otomatis.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '@/lib/db';
import {
  resolvePaymentAccount,
  resolveExpenseAccount,
  resolveIncomeAccount,
  DEFAULT_CHART_OF_ACCOUNTS,
} from './accounts';

// ─────────────────────────────────────────────────────────────────────────────
// SEED DEFAULT CoA untuk toko baru
// Dipanggil saat register-store
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDefaultAccounts(storeId: string): Promise<void> {
  const data = DEFAULT_CHART_OF_ACCOUNTS.map((acc) => ({
    storeId,
    code: acc.code,
    name: acc.name,
    type: acc.type,
    isSystem: acc.isSystem,
  }));

  // createMany dengan skipDuplicates agar aman dipanggil ulang
  await db.account.createMany({ data, skipDuplicates: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — Resolve account ID dari code
// ─────────────────────────────────────────────────────────────────────────────

async function getAccountId(storeId: string, code: string): Promise<string> {
  const account = await db.account.findUnique({
    where: { storeId_code: { storeId, code } },
    select: { id: true },
  });

  if (!account) {
    throw new Error(`Account code ${code} tidak ditemukan untuk store ${storeId}. Pastikan CoA sudah di-seed.`);
  }

  return account.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE JOURNAL DARI POS SALE
//
// Setiap penjualan menghasilkan 2 jurnal:
// 1. Kas/Bank (D) vs Pendapatan Penjualan (K) — uang masuk
// 2. HPP (D)      vs Persediaan Barang (K)     — stok keluar
// ─────────────────────────────────────────────────────────────────────────────

interface SaleJournalInput {
  storeId:       string;
  saleId:        string;
  total:         number; // total penjualan
  hpp:           number; // total harga pokok (cost * qty)
  paymentMethod: string;
  date:          Date;
  saleNumber:    string;
}

export async function generateSaleJournals(input: SaleJournalInput): Promise<void> {
  const { storeId, saleId, total, hpp, paymentMethod, date, saleNumber } = input;

  // Hapus jurnal lama jika ada (untuk re-generate saat sale di-edit)
  await db.journalEntry.deleteMany({
    where: { sourceType: 'POS_SALE', sourceId: saleId },
  });

  if (total <= 0) return;

  const cashAccountCode = resolvePaymentAccount(paymentMethod);

  const [cashId, revenueId, hppId, inventoryId] = await Promise.all([
    getAccountId(storeId, cashAccountCode),
    getAccountId(storeId, '4001'), // Pendapatan Penjualan
    getAccountId(storeId, '5001'), // HPP
    getAccountId(storeId, '1004'), // Persediaan Barang
  ]);

  const entries = [];

  // Jurnal 1: Kas/Bank bertambah, Pendapatan bertambah
  entries.push({
    storeId,
    date,
    debitId:     cashId,
    creditId:    revenueId,
    amount:      total,
    description: `Penjualan #${saleNumber}`,
    sourceType:  'POS_SALE' as const,
    sourceId:    saleId,
  });

  // Jurnal 2: HPP bertambah, Persediaan berkurang (hanya jika hpp > 0)
  if (hpp > 0) {
    entries.push({
      storeId,
      date,
      debitId:     hppId,
      creditId:    inventoryId,
      amount:      hpp,
      description: `HPP Penjualan #${saleNumber}`,
      sourceType:  'POS_SALE' as const,
      sourceId:    saleId,
    });
  }

  await db.journalEntry.createMany({ data: entries });
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE JOURNAL DARI CASHFLOW MANUAL
//
// EXPENSE:
//   Debit  BebanXxx  (berdasarkan kategori)
//   Kredit Kas/Bank  (berdasarkan metode bayar)
//
// INCOME (non-penjualan):
//   Debit  Kas/Bank
//   Kredit PendapatanXxx / Modal / Utang
// ─────────────────────────────────────────────────────────────────────────────

interface CashflowJournalInput {
  storeId:       string;
  cashflowId:    string;
  type:          'INCOME' | 'EXPENSE';
  category:      string;
  amount:        number;
  paymentMethod: string; // default 'CASH' jika tidak ada
  date:          Date;
  description:   string;
}

export async function generateCashflowJournal(input: CashflowJournalInput): Promise<void> {
  const { storeId, cashflowId, type, category, amount, paymentMethod, date, description } = input;

  // Hapus jurnal lama jika re-generate
  await db.journalEntry.deleteMany({
    where: { sourceType: 'CASHFLOW', sourceId: cashflowId },
  });

  if (amount <= 0) return;

  const cashAccountCode = resolvePaymentAccount(paymentMethod);

  let debitCode: string;
  let creditCode: string;

  if (type === 'EXPENSE') {
    debitCode  = resolveExpenseAccount(category);  // Beban Xxx bertambah
    creditCode = cashAccountCode;                   // Kas/Bank berkurang
  } else {
    // INCOME
    debitCode  = cashAccountCode;                   // Kas/Bank bertambah
    creditCode = resolveIncomeAccount(category);    // Pendapatan/Modal bertambah
  }

  const [debitId, creditId] = await Promise.all([
    getAccountId(storeId, debitCode),
    getAccountId(storeId, creditCode),
  ]);

  await db.journalEntry.create({
    data: {
      storeId,
      date,
      debitId,
      creditId,
      amount,
      description: description || `${type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} - ${category}`,
      sourceType:  'CASHFLOW',
      sourceId:    cashflowId,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE JOURNAL ENTRIES
// Dipanggil saat sale atau cashflow dihapus
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteJournalsBySource(
  sourceType: 'POS_SALE' | 'CASHFLOW',
  sourceId: string,
): Promise<void> {
  await db.journalEntry.deleteMany({ where: { sourceType, sourceId } });
}
