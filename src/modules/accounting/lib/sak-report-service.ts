// ─────────────────────────────────────────────────────────────────────────────
// SAK EMKM REPORT SERVICE
// Laporan keuangan sesuai Standar Akuntansi Keuangan Entitas Mikro Kecil
// Menengah (SAK EMKM) — terdiri dari 3 laporan wajib:
// 1. Laporan Laba Rugi
// 2. Neraca (Laporan Posisi Keuangan)
// 3. Catatan atas Laporan Keuangan (ringkasan)
//
// Arus Kas ditambahkan sebagai laporan tambahan (best practice).
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '@/lib/db';

export interface DateRange {
  from: Date;
  to:   Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — ambil saldo akun per kode dalam range tanggal
// ─────────────────────────────────────────────────────────────────────────────

async function getAccountBalance(storeId: string, code: string, range: DateRange): Promise<number> {
  const account = await db.account.findUnique({
    where:  { storeId_code: { storeId, code } },
    select: { id: true, type: true },
  });
  if (!account) return 0;

  const [debitAgg, creditAgg] = await Promise.all([
    db.journalEntry.aggregate({
      where: { storeId, debitId: account.id, date: { gte: range.from, lte: range.to } },
      _sum:  { amount: true },
    }),
    db.journalEntry.aggregate({
      where: { storeId, creditId: account.id, date: { gte: range.from, lte: range.to } },
      _sum:  { amount: true },
    }),
  ]);

  const debit  = Number(debitAgg._sum.amount  || 0);
  const credit = Number(creditAgg._sum.amount || 0);

  // Normal balance: ASSET & EXPENSE = debit; LIABILITY, EQUITY, REVENUE = credit
  const isNormalDebit = ['ASSET', 'EXPENSE'].includes(account.type);
  return isNormalDebit ? debit - credit : credit - debit;
}

async function getAccountBalanceAllTime(storeId: string, code: string): Promise<number> {
  const account = await db.account.findUnique({
    where:  { storeId_code: { storeId, code } },
    select: { id: true, type: true },
  });
  if (!account) return 0;

  const [debitAgg, creditAgg] = await Promise.all([
    db.journalEntry.aggregate({ where: { storeId, debitId:  account.id }, _sum: { amount: true } }),
    db.journalEntry.aggregate({ where: { storeId, creditId: account.id }, _sum: { amount: true } }),
  ]);

  const debit  = Number(debitAgg._sum.amount  || 0);
  const credit = Number(creditAgg._sum.amount || 0);
  const isNormalDebit = ['ASSET', 'EXPENSE'].includes(account.type);
  return isNormalDebit ? debit - credit : credit - debit;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LAPORAN LABA RUGI (Income Statement)
// SAK EMKM: Pendapatan - Beban = Laba/Rugi Periode Berjalan
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfitLossLine  { code: string; name: string; amount: number }
export interface ProfitLossReport {
  pendapatan:      ProfitLossLine[];
  hpp:             number;
  labaKotor:       number;
  bebanOperasional: ProfitLossLine[];
  totalBeban:      number;
  labaBersih:      number;
  isProfit:        boolean;
}

export async function getSAKProfitLoss(storeId: string, range: DateRange): Promise<ProfitLossReport> {
  const accounts = await db.account.findMany({
    where:   { storeId, isActive: true, type: { in: ['REVENUE', 'EXPENSE'] } },
    orderBy: { code: 'asc' },
  });

  const lines: ProfitLossLine[] = [];

  for (const account of accounts) {
    const [debitAgg, creditAgg] = await Promise.all([
      db.journalEntry.aggregate({ where: { storeId, debitId:  account.id, date: { gte: range.from, lte: range.to } }, _sum: { amount: true } }),
      db.journalEntry.aggregate({ where: { storeId, creditId: account.id, date: { gte: range.from, lte: range.to } }, _sum: { amount: true } }),
    ]);
    const d = Number(debitAgg._sum.amount  || 0);
    const c = Number(creditAgg._sum.amount || 0);
    const amount = account.type === 'REVENUE' ? c - d : d - c;
    if (amount !== 0) lines.push({ code: account.code, name: account.name, amount });
  }

  const pendapatan       = lines.filter(l => l.code.startsWith('4'));
  const hppLine          = lines.find(l => l.code === '5001');
  const bebanOperasional = lines.filter(l => l.code.startsWith('5') && l.code !== '5001');

  const totalPendapatan = pendapatan.reduce((s, l) => s + l.amount, 0);
  const hpp             = hppLine?.amount ?? 0;
  const labaKotor       = totalPendapatan - hpp;
  const totalBebanOps   = bebanOperasional.reduce((s, l) => s + l.amount, 0);
  const labaBersih      = labaKotor - totalBebanOps;

  return {
    pendapatan,
    hpp,
    labaKotor,
    bebanOperasional,
    totalBeban:  hpp + totalBebanOps,
    labaBersih,
    isProfit:    labaBersih >= 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. NERACA / LAPORAN POSISI KEUANGAN (Balance Sheet)
// SAK EMKM: Aset = Liabilitas + Ekuitas
// Neraca menggunakan saldo kumulatif (all-time), bukan per periode
// ─────────────────────────────────────────────────────────────────────────────

export interface BalanceSheetLine { code: string; name: string; amount: number }
export interface BalanceSheetReport {
  // ASET
  asetLancar:      BalanceSheetLine[];
  asetTidakLancar: BalanceSheetLine[];
  totalAset:       number;
  // LIABILITAS
  liabilitasJangkaPendek: BalanceSheetLine[];
  liabilitasJangkaPanjang: BalanceSheetLine[];
  totalLiabilitas: number;
  // EKUITAS
  ekuitas:         BalanceSheetLine[];
  labaPeriodeBerjalan: number;
  totalEkuitas:    number;
  // VALIDASI
  isBalanced:      boolean;
  selisih:         number;
}

export async function getSAKBalanceSheet(storeId: string, range: DateRange): Promise<BalanceSheetReport> {
  const accounts = await db.account.findMany({
    where:   { storeId, isActive: true, type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } },
    orderBy: { code: 'asc' },
  });

  const lines: BalanceSheetLine[] = [];

  for (const account of accounts) {
    const [debitAgg, creditAgg] = await Promise.all([
      db.journalEntry.aggregate({ where: { storeId, debitId:  account.id }, _sum: { amount: true } }),
      db.journalEntry.aggregate({ where: { storeId, creditId: account.id }, _sum: { amount: true } }),
    ]);
    const d = Number(debitAgg._sum.amount  || 0);
    const c = Number(creditAgg._sum.amount || 0);
    const isNormalDebit = account.type === 'ASSET';
    const amount = isNormalDebit ? d - c : c - d;
    lines.push({ code: account.code, name: account.name, amount });
  }

  // Laba periode berjalan dari laporan laba rugi (masuk ekuitas)
  const plReport = await getSAKProfitLoss(storeId, range);

  // Klasifikasi
  const asetLancar            = lines.filter(l => ['1001','1002','1003'].includes(l.code));
  const asetTidakLancar       = lines.filter(l => ['1004','1005'].includes(l.code));
  const liabilitasJangkaPendek = lines.filter(l => l.code === '2001');
  const liabilitasJangkaPanjang = lines.filter(l => l.code === '2002');
  const ekuitas               = lines.filter(l => l.code.startsWith('3'));

  const totalAset       = [...asetLancar, ...asetTidakLancar].reduce((s, l) => s + l.amount, 0);
  const totalLiabilitas = [...liabilitasJangkaPendek, ...liabilitasJangkaPanjang].reduce((s, l) => s + l.amount, 0);
  const totalEkuitasBase = ekuitas.reduce((s, l) => s + l.amount, 0);
  const totalEkuitas    = totalEkuitasBase + plReport.labaBersih;

  const selisih    = totalAset - (totalLiabilitas + totalEkuitas);
  const isBalanced = Math.abs(selisih) < 1;

  return {
    asetLancar, asetTidakLancar, totalAset,
    liabilitasJangkaPendek, liabilitasJangkaPanjang, totalLiabilitas,
    ekuitas, labaPeriodeBerjalan: plReport.labaBersih, totalEkuitas,
    isBalanced, selisih,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LAPORAN ARUS KAS (Cash Flow Statement)
// Metode langsung (direct method) — lebih mudah dipahami SME
// ─────────────────────────────────────────────────────────────────────────────

export interface CashFlowReport {
  // Aktivitas Operasi
  penerimaanDariPelanggan: number;
  pembayaranKeSupplier:    number;
  pembayaranBebanOperasi:  number;
  arusKasOperasi:          number;
  // Aktivitas Investasi
  pembelianAset:           number;
  arusKasInvestasi:        number;
  // Aktivitas Pendanaan
  penerimaanModal:         number;
  pembayaranUtang:         number;
  arusKasPendanaan:        number;
  // Total
  kenaikanPenurunanKas:    number;
  saldoKasAwal:            number;
  saldoKasAkhir:           number;
}

export async function getSAKCashFlow(storeId: string, range: DateRange): Promise<CashFlowReport> {
  const kasId = await db.account.findUnique({
    where:  { storeId_code: { storeId, code: '1001' } },
    select: { id: true },
  });

  if (!kasId) return {
    penerimaanDariPelanggan: 0, pembayaranKeSupplier: 0, pembayaranBebanOperasi: 0,
    arusKasOperasi: 0, pembelianAset: 0, arusKasInvestasi: 0,
    penerimaanModal: 0, pembayaranUtang: 0, arusKasPendanaan: 0,
    kenaikanPenurunanKas: 0, saldoKasAwal: 0, saldoKasAkhir: 0,
  };

  // Semua pergerakan kas dalam periode
  const kasEntries = await db.journalEntry.findMany({
    where: {
      storeId,
      date: { gte: range.from, lte: range.to },
      OR:   [{ debitId: kasId.id }, { creditId: kasId.id }],
    },
    include: {
      debit:  { select: { code: true, type: true } },
      credit: { select: { code: true, type: true } },
    },
  });

  let penerimaanDariPelanggan = 0;
  let pembayaranKeSupplier    = 0;
  let pembayaranBebanOperasi  = 0;
  let pembelianAset           = 0;
  let penerimaanModal         = 0;
  let pembayaranUtang         = 0;

  for (const entry of kasEntries) {
    const amount  = Number(entry.amount);
    const kasIn   = entry.debitId  === kasId.id; // kas masuk = debit kas
    const otherCode = kasIn ? entry.credit.code : entry.debit.code;

    if (kasIn) {
      // Kas masuk
      if (otherCode.startsWith('4'))         penerimaanDariPelanggan += amount; // dari pendapatan
      else if (otherCode === '3001')         penerimaanModal         += amount; // tambah modal
      else if (otherCode === '2002')         penerimaanModal         += amount; // pinjaman bank
      else if (otherCode === '1003')         penerimaanDariPelanggan += amount; // terima piutang
    } else {
      // Kas keluar
      if (otherCode === '1004')              pembayaranKeSupplier    += amount; // beli stok
      else if (otherCode === '2001')         pembayaranUtang         += amount; // bayar utang dagang
      else if (otherCode === '2002')         pembayaranUtang         += amount; // bayar utang bank
      else if (otherCode === '1005')         pembelianAset           += amount; // beli aset
      else if (otherCode.startsWith('5'))    pembayaranBebanOperasi  += amount; // beban operasi
    }
  }

  // Saldo kas awal (sebelum range.from)
  const kasAwalDebit = await db.journalEntry.aggregate({
    where: { storeId, debitId: kasId.id, date: { lt: range.from } },
    _sum:  { amount: true },
  });
  const kasAwalCredit = await db.journalEntry.aggregate({
    where: { storeId, creditId: kasId.id, date: { lt: range.from } },
    _sum:  { amount: true },
  });
  const saldoKasAwal = Number(kasAwalDebit._sum.amount || 0) - Number(kasAwalCredit._sum.amount || 0);

  const arusKasOperasi    = penerimaanDariPelanggan - pembayaranKeSupplier - pembayaranBebanOperasi;
  const arusKasInvestasi  = -pembelianAset;
  const arusKasPendanaan  = penerimaanModal - pembayaranUtang;
  const kenaikanPenurunan = arusKasOperasi + arusKasInvestasi + arusKasPendanaan;

  return {
    penerimaanDariPelanggan, pembayaranKeSupplier, pembayaranBebanOperasi, arusKasOperasi,
    pembelianAset, arusKasInvestasi,
    penerimaanModal, pembayaranUtang, arusKasPendanaan,
    kenaikanPenurunanKas: kenaikanPenurunan,
    saldoKasAwal,
    saldoKasAkhir: saldoKasAwal + kenaikanPenurunan,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — info toko untuk header laporan
// ─────────────────────────────────────────────────────────────────────────────

export async function getStoreInfo(storeId: string) {
  return db.store.findUnique({
    where:  { id: storeId },
    select: { name: true, slug: true, createdAt: true },
  });
}
