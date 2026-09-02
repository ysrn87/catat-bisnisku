// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTING SERVICE
// Query layer untuk Buku Besar, Laba Rugi, dan Neraca Saldo
// Semua laporan di-derive dari JournalEntry — single source of truth
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '@/lib/db';

export interface DateRange {
  from?: Date;
  to?:   Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUKU BESAR (General Ledger)
// Semua aktivitas per akun, berurutan per tanggal
// ─────────────────────────────────────────────────────────────────────────────

export interface LedgerLine {
  date:        Date;
  description: string;
  debit:       number;
  credit:      number;
  balance:     number; // running balance
  sourceType:  string;
  sourceId:    string;
}

export interface LedgerAccount {
  code:        string;
  name:        string;
  type:        string;
  lines:       LedgerLine[];
  totalDebit:  number;
  totalCredit: number;
  endBalance:  number;
}

export async function getLedger(
  storeId: string,
  range: DateRange,
  accountCode?: string, // filter per akun, undefined = semua
): Promise<LedgerAccount[]> {
  const dateFilter = buildDateFilter(range);

  const accounts = await db.account.findMany({
    where: {
      storeId,
      isActive: true,
      ...(accountCode ? { code: accountCode } : {}),
    },
    orderBy: { code: 'asc' },
  });

  const results: LedgerAccount[] = [];

  for (const account of accounts) {
    // Ambil semua entries di mana akun ini sebagai debit atau kredit
    const entries = await db.journalEntry.findMany({
      where: {
        storeId,
        date: dateFilter,
        OR: [
          { debitId:  account.id },
          { creditId: account.id },
        ],
      },
      orderBy: { date: 'asc' },
    });

    if (entries.length === 0) continue;

    let runningBalance = 0;
    const lines: LedgerLine[] = [];

    for (const entry of entries) {
      const amount = Number(entry.amount);
      const isDebit = entry.debitId === account.id;

      // Untuk aset & beban: debit menambah saldo
      // Untuk liabilitas, ekuitas, pendapatan: kredit menambah saldo
      const isNormalDebit = account.type === 'ASSET' || account.type === 'EXPENSE';
      if (isNormalDebit) {
        runningBalance += isDebit ? amount : -amount;
      } else {
        runningBalance += isDebit ? -amount : amount;
      }

      lines.push({
        date:        entry.date,
        description: entry.description,
        debit:       isDebit ? amount : 0,
        credit:      isDebit ? 0 : amount,
        balance:     runningBalance,
        sourceType:  entry.sourceType,
        sourceId:    entry.sourceId,
      });
    }

    const totalDebit  = lines.reduce((s, l) => s + l.debit,  0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

    results.push({
      code:        account.code,
      name:        account.name,
      type:        account.type,
      lines,
      totalDebit,
      totalCredit,
      endBalance:  runningBalance,
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAPORAN LABA RUGI (Income Statement / Profit & Loss)
// Pendapatan - Beban = Laba Bersih
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfitLossLine {
  code:   string;
  name:   string;
  amount: number;
}

export interface ProfitLossReport {
  revenues:      ProfitLossLine[];
  expenses:      ProfitLossLine[];
  totalRevenue:  number;
  totalExpense:  number;
  grossProfit:   number; // Revenue - HPP
  netProfit:     number; // Revenue - All Expenses
  period:        { from?: Date; to?: Date };
}

export async function getProfitLossReport(
  storeId: string,
  range: DateRange,
): Promise<ProfitLossReport> {
  const dateFilter = buildDateFilter(range);

  // Ambil semua akun REVENUE dan EXPENSE
  const accounts = await db.account.findMany({
    where: { storeId, isActive: true, type: { in: ['REVENUE', 'EXPENSE'] } },
    orderBy: { code: 'asc' },
  });

  const lines: ProfitLossLine[] = [];

  for (const account of accounts) {
    // Pendapatan: normal credit → kredit menambah, debit mengurangi
    // Beban: normal debit → debit menambah, kredit mengurangi
    const [debitAgg, creditAgg] = await Promise.all([
      db.journalEntry.aggregate({
        where: { storeId, date: dateFilter, debitId: account.id },
        _sum: { amount: true },
      }),
      db.journalEntry.aggregate({
        where: { storeId, date: dateFilter, creditId: account.id },
        _sum: { amount: true },
      }),
    ]);

    const totalDebit  = Number(debitAgg._sum.amount  || 0);
    const totalCredit = Number(creditAgg._sum.amount || 0);

    let amount: number;
    if (account.type === 'REVENUE') {
      amount = totalCredit - totalDebit; // kredit = positif untuk pendapatan
    } else {
      amount = totalDebit - totalCredit; // debit = positif untuk beban
    }

    if (amount !== 0) {
      lines.push({ code: account.code, name: account.name, amount });
    }
  }

  const revenues = lines.filter((l) => l.code.startsWith('4'));
  const expenses = lines.filter((l) => l.code.startsWith('5'));

  const totalRevenue = revenues.reduce((s, l) => s + l.amount, 0);
  const totalExpense = expenses.reduce((s, l) => s + l.amount, 0);

  // HPP (5001) dipisahkan untuk gross profit
  const hpp = expenses.find((e) => e.code === '5001')?.amount ?? 0;
  const grossProfit = totalRevenue - hpp;

  return {
    revenues,
    expenses,
    totalRevenue,
    totalExpense,
    grossProfit,
    netProfit: totalRevenue - totalExpense,
    period: range,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NERACA SALDO (Trial Balance)
// Validasi: total debit == total kredit
// ─────────────────────────────────────────────────────────────────────────────

export interface TrialBalanceLine {
  code:   string;
  name:   string;
  type:   string;
  debit:  number;
  credit: number;
}

export interface TrialBalance {
  lines:        TrialBalanceLine[];
  totalDebit:   number;
  totalCredit:  number;
  isBalanced:   boolean;
}

export async function getTrialBalance(
  storeId: string,
  range: DateRange,
): Promise<TrialBalance> {
  const dateFilter = buildDateFilter(range);

  const accounts = await db.account.findMany({
    where: { storeId, isActive: true },
    orderBy: { code: 'asc' },
  });

  const lines: TrialBalanceLine[] = [];

  for (const account of accounts) {
    const [debitAgg, creditAgg] = await Promise.all([
      db.journalEntry.aggregate({
        where: { storeId, date: dateFilter, debitId: account.id },
        _sum: { amount: true },
      }),
      db.journalEntry.aggregate({
        where: { storeId, date: dateFilter, creditId: account.id },
        _sum: { amount: true },
      }),
    ]);

    const debit  = Number(debitAgg._sum.amount  || 0);
    const credit = Number(creditAgg._sum.amount || 0);

    if (debit > 0 || credit > 0) {
      lines.push({ code: account.code, name: account.name, type: account.type, debit, credit });
    }
  }

  const totalDebit  = lines.reduce((s, l) => s + l.debit,  0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  return {
    lines,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01, // toleransi pembulatan
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────

function buildDateFilter(range: DateRange) {
  if (!range.from && !range.to) return undefined;
  const filter: any = {};
  if (range.from) filter.gte = range.from;
  if (range.to)   filter.lte = range.to;
  return filter;
}
