import { getStoreContext } from '@/lib/store-context';
import { db } from '@/lib/db';
import {
  getSAKProfitLoss,
  getSAKBalanceSheet,
  getSAKCashFlow,
  getStoreInfo,
} from '@/modules/accounting/lib/sak-report-service';
import { DateRangeFilter } from '@/components/accounting/date-range-filter';
import { PrintButton } from '@/components/accounting/print-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react';

export default async function SAKReportPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const p = await searchParams;
  const { storeId } = await getStoreContext();

  // Cek CoA
  const accountCount = await db.account.count({ where: { storeId } });
  if (accountCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-sm font-medium">Chart of Accounts belum diinisialisasi</p>
        <p className="text-xs text-muted-foreground">
          Buka tab <strong>Laba Rugi</strong> dan klik "Inisialisasi Chart of Accounts" terlebih dahulu.
        </p>
      </div>
    );
  }

  // Default: tahun ini
  const now   = new Date();
  const from  = p.dateFrom ? new Date(p.dateFrom) : new Date(now.getFullYear(), 0, 1);
  const to    = p.dateTo   ? new Date(p.dateTo + 'T23:59:59') : new Date();
  const range = { from, to };

  const [store, pl, bs, cf] = await Promise.all([
    getStoreInfo(storeId),
    getSAKProfitLoss(storeId, range),
    getSAKBalanceSheet(storeId, range),
    getSAKCashFlow(storeId, range),
  ]);

  const periodLabel = `${from.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} s.d. ${to.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  const printedAt   = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6" id="sak-report">

      {/* Toolbar — tidak tampil saat print */}
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <DateRangeFilter defaultFrom={p.dateFrom} defaultTo={p.dateTo} />
        <PrintButton />
      </div>

      {/* Header laporan */}
      <div className="text-center space-y-1 py-4 border-y-2 border-gray-800 print:py-2">
        <h1 className="text-lg font-bold uppercase tracking-wide">{store?.name}</h1>
        <p className="text-xs text-muted-foreground">
          Laporan Keuangan · SAK EMKM · {periodLabel}
        </p>
        <p className="text-[10px] text-muted-foreground print:block hidden">
          Dicetak: {printedAt}
        </p>
      </div>

      {/* ── 1. LAPORAN LABA RUGI ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-wide">
              1. Laporan Laba Rugi
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {periodLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Periode {periodLabel}
          </p>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>

              {/* Pendapatan */}
              <tr><td colSpan={3} className="py-2 font-semibold text-gray-800 text-xs uppercase tracking-wide border-b">Pendapatan</td></tr>
              {pl.pendapatan.map((r) => (
                <tr key={r.code} className="border-b border-gray-50">
                  <td className="py-2 pl-4 font-mono text-[10px] text-gray-400 w-12">{r.code}</td>
                  <td className="py-2 text-gray-700">{r.name}</td>
                  <td className="py-2 text-right font-mono">{formatCurrency(r.amount)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td colSpan={2} className="py-2 pl-4 text-xs font-semibold">Total Pendapatan</td>
                <td className="py-2 text-right font-mono font-semibold">{formatCurrency(pl.pendapatan.reduce((s,l) => s+l.amount, 0))}</td>
              </tr>

              {/* HPP */}
              <tr><td colSpan={3} className="py-2 pt-4 font-semibold text-gray-800 text-xs uppercase tracking-wide border-b">Harga Pokok Penjualan (HPP)</td></tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 pl-4 font-mono text-[10px] text-gray-400">5001</td>
                <td className="py-2 text-gray-700">Harga Pokok Penjualan</td>
                <td className="py-2 text-right font-mono text-red-700">({formatCurrency(pl.hpp)})</td>
              </tr>
              <tr className="bg-green-50">
                <td colSpan={2} className="py-2 pl-4 text-xs font-semibold text-green-800">Laba Kotor</td>
                <td className="py-2 text-right font-mono font-semibold text-green-700">{formatCurrency(pl.labaKotor)}</td>
              </tr>

              {/* Beban Operasional */}
              {pl.bebanOperasional.length > 0 && (
                <>
                  <tr><td colSpan={3} className="py-2 pt-4 font-semibold text-gray-800 text-xs uppercase tracking-wide border-b">Beban Operasional</td></tr>
                  {pl.bebanOperasional.map((e) => (
                    <tr key={e.code} className="border-b border-gray-50">
                      <td className="py-2 pl-4 font-mono text-[10px] text-gray-400 w-12">{e.code}</td>
                      <td className="py-2 text-gray-700">{e.name}</td>
                      <td className="py-2 text-right font-mono text-red-700">({formatCurrency(e.amount)})</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td colSpan={2} className="py-2 pl-4 text-xs font-semibold">Total Beban Operasional</td>
                    <td className="py-2 text-right font-mono font-semibold text-red-700">
                      ({formatCurrency(pl.bebanOperasional.reduce((s,l) => s+l.amount, 0))})
                    </td>
                  </tr>
                </>
              )}

              {/* Laba Bersih */}
              <tr className={`border-t-2 ${pl.isProfit ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
                <td colSpan={2} className={`py-3 pl-2 text-sm font-bold ${pl.isProfit ? 'text-green-800' : 'text-red-800'}`}>
                  {pl.isProfit ? 'Laba Bersih Periode Berjalan' : 'Rugi Bersih Periode Berjalan'}
                </td>
                <td className={`py-3 text-right font-mono font-bold text-base ${pl.isProfit ? 'text-green-700' : 'text-red-700'}`}>
                  {formatCurrency(Math.abs(pl.labaBersih))}
                </td>
              </tr>

            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ── 2. NERACA ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-wide">
              2. Neraca (Laporan Posisi Keuangan)
            </CardTitle>
            {bs.isBalanced
              ? <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />Seimbang</Badge>
              : <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" />Tidak Seimbang</Badge>
            }
          </div>
          <p className="text-xs text-muted-foreground">Per {to.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">

            {/* ASET */}
            <div>
              <table className="w-full text-sm">
                <thead><tr><th colSpan={3} className="text-left py-2 text-xs uppercase tracking-wide font-bold border-b-2 border-gray-800">ASET</th></tr></thead>
                <tbody>
                  <tr><td colSpan={3} className="py-2 text-xs font-semibold text-gray-600">Aset Lancar</td></tr>
                  {bs.asetLancar.filter(a => a.amount !== 0).map(a => (
                    <tr key={a.code} className="border-b border-gray-50">
                      <td className="py-1.5 pl-3 font-mono text-[10px] text-gray-400 w-10">{a.code}</td>
                      <td className="py-1.5 text-gray-700 text-xs">{a.name}</td>
                      <td className="py-1.5 text-right font-mono text-xs">{formatCurrency(a.amount)}</td>
                    </tr>
                  ))}
                  {bs.asetTidakLancar.filter(a => a.amount !== 0).length > 0 && (
                    <>
                      <tr><td colSpan={3} className="py-2 pt-3 text-xs font-semibold text-gray-600">Aset Tidak Lancar</td></tr>
                      {bs.asetTidakLancar.filter(a => a.amount !== 0).map(a => (
                        <tr key={a.code} className="border-b border-gray-50">
                          <td className="py-1.5 pl-3 font-mono text-[10px] text-gray-400">{a.code}</td>
                          <td className="py-1.5 text-gray-700 text-xs">{a.name}</td>
                          <td className="py-1.5 text-right font-mono text-xs">{formatCurrency(a.amount)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                  <tr className="border-t-2 border-gray-800 bg-gray-50">
                    <td colSpan={2} className="py-2 text-xs font-bold">TOTAL ASET</td>
                    <td className="py-2 text-right font-mono font-bold">{formatCurrency(bs.totalAset)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* LIABILITAS + EKUITAS */}
            <div>
              <table className="w-full text-sm">
                <thead><tr><th colSpan={3} className="text-left py-2 text-xs uppercase tracking-wide font-bold border-b-2 border-gray-800">LIABILITAS & EKUITAS</th></tr></thead>
                <tbody>
                  {/* Liabilitas */}
                  <tr><td colSpan={3} className="py-2 text-xs font-semibold text-gray-600">Liabilitas Jangka Pendek</td></tr>
                  {bs.liabilitasJangkaPendek.filter(l => l.amount !== 0).map(l => (
                    <tr key={l.code} className="border-b border-gray-50">
                      <td className="py-1.5 pl-3 font-mono text-[10px] text-gray-400 w-10">{l.code}</td>
                      <td className="py-1.5 text-gray-700 text-xs">{l.name}</td>
                      <td className="py-1.5 text-right font-mono text-xs">{formatCurrency(l.amount)}</td>
                    </tr>
                  ))}
                  {bs.liabilitasJangkaPanjang.filter(l => l.amount !== 0).length > 0 && (
                    <>
                      <tr><td colSpan={3} className="py-2 pt-3 text-xs font-semibold text-gray-600">Liabilitas Jangka Panjang</td></tr>
                      {bs.liabilitasJangkaPanjang.filter(l => l.amount !== 0).map(l => (
                        <tr key={l.code} className="border-b border-gray-50">
                          <td className="py-1.5 pl-3 font-mono text-[10px] text-gray-400">{l.code}</td>
                          <td className="py-1.5 text-gray-700 text-xs">{l.name}</td>
                          <td className="py-1.5 text-right font-mono text-xs">{formatCurrency(l.amount)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={2} className="py-1.5 text-xs font-semibold">Total Liabilitas</td>
                    <td className="py-1.5 text-right font-mono text-xs font-semibold">{formatCurrency(bs.totalLiabilitas)}</td>
                  </tr>

                  {/* Ekuitas */}
                  <tr><td colSpan={3} className="py-2 pt-4 text-xs font-semibold text-gray-600">Ekuitas</td></tr>
                  {bs.ekuitas.filter(e => e.amount !== 0).map(e => (
                    <tr key={e.code} className="border-b border-gray-50">
                      <td className="py-1.5 pl-3 font-mono text-[10px] text-gray-400">{e.code}</td>
                      <td className="py-1.5 text-gray-700 text-xs">{e.name}</td>
                      <td className="py-1.5 text-right font-mono text-xs">{formatCurrency(e.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-gray-50">
                    <td className="py-1.5 pl-3 font-mono text-[10px] text-gray-400"></td>
                    <td className="py-1.5 text-gray-700 text-xs italic">
                      {pl.isProfit ? 'Laba' : 'Rugi'} Periode Berjalan
                    </td>
                    <td className={`py-1.5 text-right font-mono text-xs ${pl.isProfit ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCurrency(bs.labaPeriodeBerjalan)}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={2} className="py-1.5 text-xs font-semibold">Total Ekuitas</td>
                    <td className="py-1.5 text-right font-mono text-xs font-semibold">{formatCurrency(bs.totalEkuitas)}</td>
                  </tr>

                  <tr className="border-t-2 border-gray-800 bg-gray-50">
                    <td colSpan={2} className="py-2 text-xs font-bold">TOTAL LIABILITAS & EKUITAS</td>
                    <td className="py-2 text-right font-mono font-bold">{formatCurrency(bs.totalLiabilitas + bs.totalEkuitas)}</td>
                  </tr>
                </tbody>
              </table>

              {!bs.isBalanced && (
                <p className="text-[10px] text-red-500 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Selisih {formatCurrency(Math.abs(bs.selisih))} — pastikan semua transaksi sudah tercatat.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. LAPORAN ARUS KAS ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wide">
            3. Laporan Arus Kas
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Metode Langsung · Periode {periodLabel}
          </p>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>

              {/* Aktivitas Operasi */}
              <tr><td colSpan={2} className="py-2 font-semibold text-xs uppercase tracking-wide border-b">Aktivitas Operasi</td></tr>
              <CashFlowRow label="Penerimaan dari Pelanggan"      value={cf.penerimaanDariPelanggan} positive />
              <CashFlowRow label="Pembayaran kepada Supplier"     value={cf.pembayaranKeSupplier}    />
              <CashFlowRow label="Pembayaran Beban Operasional"   value={cf.pembayaranBebanOperasi}  />
              <tr className="bg-gray-50 border-t">
                <td className="py-2 text-xs font-semibold">Arus Kas Bersih dari Aktivitas Operasi</td>
                <td className={`py-2 text-right font-mono font-semibold ${cf.arusKasOperasi >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {cf.arusKasOperasi >= 0 ? '' : '('}{formatCurrency(Math.abs(cf.arusKasOperasi))}{cf.arusKasOperasi >= 0 ? '' : ')'}
                </td>
              </tr>

              {/* Aktivitas Investasi */}
              <tr><td colSpan={2} className="py-2 pt-4 font-semibold text-xs uppercase tracking-wide border-b">Aktivitas Investasi</td></tr>
              <CashFlowRow label="Pembelian Aset Tetap" value={cf.pembelianAset} />
              <tr className="bg-gray-50 border-t">
                <td className="py-2 text-xs font-semibold">Arus Kas Bersih dari Aktivitas Investasi</td>
                <td className={`py-2 text-right font-mono font-semibold ${cf.arusKasInvestasi >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {cf.arusKasInvestasi >= 0 ? '' : '('}{formatCurrency(Math.abs(cf.arusKasInvestasi))}{cf.arusKasInvestasi >= 0 ? '' : ')'}
                </td>
              </tr>

              {/* Aktivitas Pendanaan */}
              <tr><td colSpan={2} className="py-2 pt-4 font-semibold text-xs uppercase tracking-wide border-b">Aktivitas Pendanaan</td></tr>
              <CashFlowRow label="Penerimaan Modal / Pinjaman" value={cf.penerimaanModal}  positive />
              <CashFlowRow label="Pembayaran Utang Bank"       value={cf.pembayaranUtang}  />
              <tr className="bg-gray-50 border-t">
                <td className="py-2 text-xs font-semibold">Arus Kas Bersih dari Aktivitas Pendanaan</td>
                <td className={`py-2 text-right font-mono font-semibold ${cf.arusKasPendanaan >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {cf.arusKasPendanaan >= 0 ? '' : '('}{formatCurrency(Math.abs(cf.arusKasPendanaan))}{cf.arusKasPendanaan >= 0 ? '' : ')'}
                </td>
              </tr>

              {/* Ringkasan */}
              <tr className="border-t-2 border-gray-800">
                <td className="py-2 text-xs font-semibold">
                  {cf.kenaikanPenurunanKas >= 0 ? 'Kenaikan' : 'Penurunan'} Kas Bersih
                </td>
                <td className={`py-2 text-right font-mono font-semibold ${cf.kenaikanPenurunanKas >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatCurrency(Math.abs(cf.kenaikanPenurunanKas))}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 text-xs text-gray-600">Saldo Kas Awal Periode</td>
                <td className="py-1.5 text-right font-mono text-xs">{formatCurrency(cf.saldoKasAwal)}</td>
              </tr>
              <tr className="bg-blue-50 border-t border-blue-200">
                <td className="py-2 text-xs font-bold text-blue-800">Saldo Kas Akhir Periode</td>
                <td className="py-2 text-right font-mono font-bold text-blue-700">{formatCurrency(cf.saldoKasAkhir)}</td>
              </tr>

            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ── CATATAN LAPORAN ──────────────────────────────────────────────────── */}
      <Card className="print:break-inside-avoid">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Catatan atas Laporan Keuangan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-gray-600">
          <div>
            <p className="font-semibold text-gray-800 mb-1">1. Dasar Penyusunan</p>
            <p>Laporan keuangan disusun berdasarkan Standar Akuntansi Keuangan Entitas Mikro, Kecil, dan Menengah (SAK EMKM) yang diterbitkan oleh Ikatan Akuntan Indonesia (IAI).</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">2. Dasar Pengukuran</p>
            <p>Laporan keuangan disusun atas dasar biaya historis menggunakan konsep harga perolehan (historical cost convention).</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">3. Mata Uang Pelaporan</p>
            <p>Laporan keuangan disajikan dalam Rupiah (IDR) yang merupakan mata uang fungsional entitas.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">4. Persediaan</p>
            <p>Persediaan dinilai berdasarkan harga perolehan menggunakan metode rata-rata (average cost). HPP dihitung dari harga modal produk yang tercatat di sistem.</p>
          </div>
          <p className="text-[10px] text-gray-400 pt-2 border-t">
            Laporan ini digenerate otomatis oleh sistem Catat Bisnisku berdasarkan transaksi yang tercatat.
            Direkomendasikan untuk diverifikasi oleh akuntan sebelum digunakan untuk keperluan formal.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}

// Helper component untuk baris arus kas
function CashFlowRow({ label, value, positive = false }: { label: string; value: number; positive?: boolean }) {
  if (value === 0) return null;
  const display = positive ? formatCurrency(value) : `(${formatCurrency(value)})`;
  return (
    <tr className="border-b border-gray-50">
      <td className="py-1.5 pl-4 text-gray-600">{label}</td>
      <td className={`py-1.5 text-right font-mono ${positive ? 'text-gray-800' : 'text-red-700'}`}>
        {display}
      </td>
    </tr>
  );
}
