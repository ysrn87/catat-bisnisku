// ─────────────────────────────────────────────────────────────────────────────
// JOURNAL ENGINE
// Mengubah transaksi bisnis (POS sale, cashflow manual) menjadi
// double-entry journal entries secara otomatis.
// ─────────────────────────────────────────────────────────────────────────────

import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { paymentMethodLabel } from '@/lib/payment';
import {
  resolvePaymentAccount,
  resolveExpenseAccount,
  resolveIncomeAccount,
  DEFAULT_CHART_OF_ACCOUNTS,
  ACCOUNT_RECEIVABLE,
  ACCOUNT_SALES_REVENUE,
  ACCOUNT_COGS,
  ACCOUNT_INVENTORY,
} from './accounts';

/** Client Prisma biasa ATAU client transaksi (tx) — agar jurnal bisa ikut atomik dengan penjualan. */
type JournalClient = Prisma.TransactionClient;

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
//
// Akun yang belum ada (toko lama belum seed CoA, atau akun non-sistem terhapus)
// dibuat otomatis dari DEFAULT_CHART_OF_ACCOUNTS. Aman dipanggil berulang
// (skipDuplicates) sehingga kasir tidak pernah terblokir karena CoA belum siap.
// ─────────────────────────────────────────────────────────────────────────────

async function resolveAccountIds(
  client: JournalClient,
  storeId: string,
  codes: string[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(codes)];

  const load = async () => {
    const rows = await client.account.findMany({
      where:  { storeId, code: { in: wanted } },
      select: { id: true, code: true },
    });
    return new Map(rows.map((r) => [r.code, r.id]));
  };

  let ids = await load();
  if (ids.size < wanted.length) {
    const missing = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => wanted.includes(a.code) && !ids.has(a.code));
    if (missing.length > 0) {
      await client.account.createMany({
        data: missing.map((a) => ({ storeId, code: a.code, name: a.name, type: a.type, isSystem: a.isSystem })),
        skipDuplicates: true,
      });
      ids = await load();
    }
  }

  const stillMissing = wanted.filter((c) => !ids.has(c));
  if (stillMissing.length > 0) {
    throw new Error(`Akun ${stillMissing.join(', ')} tidak ditemukan untuk store ${storeId}.`);
  }
  return ids;
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE JOURNAL DARI POS SALE
//
// LUNAS — satu jurnal per metode pembayaran (split = beberapa baris):
//   Kas/Bank (D)  vs  Pendapatan Penjualan (K)    sebesar nominal tiap metode
//   Catatan: kembalian TIDAK dijurnal — yang masuk kas hanya nominal yang
//   melunasi transaksi (uang diterima − kembalian).
// PENDING — belum ada uang masuk:
//   Piutang Dagang (D) vs Pendapatan Penjualan (K) sebesar total
// Selalu (bila HPP > 0):
//   HPP (D) vs Persediaan Barang (K)
//
// Idempoten: jurnal lama sale ini dihapus dulu, jadi aman dipanggil ulang
// saat transaksi diedit.
// ─────────────────────────────────────────────────────────────────────────────

export interface SaleJournalPayment {
  method: string;
  amount: number;
}

interface SaleJournalInput {
  storeId:    string;
  saleId:     string;
  total:      number; // total penjualan
  hpp:        number; // total harga pokok (cost * qty)
  date:       Date;
  saleNumber: string;
  /** PAID → jurnal ke Kas/Bank sesuai `payments`; PENDING → Piutang Dagang. */
  status:     'PAID' | 'PENDING';
  /** Rincian pembayaran (hanya dipakai bila PAID). Kosong → dianggap Tunai senilai total. */
  payments:   SaleJournalPayment[];
}

const toCents = (n: number) => Math.round(n * 100);

export async function generateSaleJournals(
  input: SaleJournalInput,
  client: JournalClient = db,
): Promise<void> {
  const { storeId, saleId, total, hpp, date, saleNumber, status } = input;

  // Hapus jurnal lama jika ada (untuk re-generate saat sale di-edit)
  await client.journalEntry.deleteMany({
    where: { sourceType: 'POS_SALE', sourceId: saleId },
  });

  if (total <= 0) return;

  // Sisi debit: dari mana "uang" penjualan ini berasal
  const debits: Array<{ code: string; amount: number; label: string }> =
    status === 'PENDING'
      ? [{ code: ACCOUNT_RECEIVABLE, amount: total, label: 'Piutang' }]
      : (input.payments.length > 0 ? input.payments : [{ method: 'CASH', amount: total }]).map((p) => ({
          code:   resolvePaymentAccount(p.method),
          amount: p.amount,
          label:  paymentMethodLabel(p.method),
        }));

  // Jaga buku tetap seimbang: total debit harus sama dengan pendapatan yang diakui
  const debitSum = debits.reduce((sum, d) => sum + toCents(d.amount), 0);
  if (debitSum !== toCents(total)) {
    throw new Error(`Jurnal penjualan ${saleNumber} tidak seimbang: pembayaran ${debitSum / 100} ≠ total ${total}`);
  }

  const ids = await resolveAccountIds(client, storeId, [
    ...debits.map((d) => d.code),
    ACCOUNT_SALES_REVENUE,
    ...(hpp > 0 ? [ACCOUNT_COGS, ACCOUNT_INVENTORY] : []),
  ]);

  const entries: Prisma.JournalEntryCreateManyInput[] = debits.map((d) => ({
    storeId,
    date,
    debitId:     ids.get(d.code)!,
    creditId:    ids.get(ACCOUNT_SALES_REVENUE)!,
    amount:      d.amount,
    description: debits.length > 1 || status === 'PENDING'
      ? `Penjualan #${saleNumber} (${d.label})`
      : `Penjualan #${saleNumber}`,
    sourceType:  'POS_SALE',
    sourceId:    saleId,
  }));

  // HPP bertambah, Persediaan berkurang (hanya jika hpp > 0)
  if (hpp > 0) {
    entries.push({
      storeId,
      date,
      debitId:     ids.get(ACCOUNT_COGS)!,
      creditId:    ids.get(ACCOUNT_INVENTORY)!,
      amount:      hpp,
      description: `HPP Penjualan #${saleNumber}`,
      sourceType:  'POS_SALE',
      sourceId:    saleId,
    });
  }

  await client.journalEntry.createMany({ data: entries });
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

  const ids      = await resolveAccountIds(db, storeId, [debitCode, creditCode]);
  const debitId  = ids.get(debitCode)!;
  const creditId = ids.get(creditCode)!;

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
  client: JournalClient = db,
): Promise<void> {
  await client.journalEntry.deleteMany({ where: { sourceType, sourceId } });
}
