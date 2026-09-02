import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { getProfitLossReport } from '@/modules/accounting/lib/accounting-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { DateRangeFilter } from '@/components/accounting/date-range-filter';
import { SeedAccountingButton } from '@/components/accounting/seed-accounting-button';
import { BackfillJournalsButton } from '@/components/accounting/backfill-journals-button';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const p = await searchParams;
  const { storeId } = await getStoreContext();

  // Cek apakah CoA sudah di-seed
  const accountCount = await db.account.count({ where: { storeId } });
  const isSeeded = accountCount > 0;

  // Jika belum di-seed, tampilkan banner setup
  if (!isSeeded) {
    return (
      <div className="space-y-5">
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Chart of Accounts belum diinisialisasi
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Klik tombol di bawah untuk membuat daftar akun default. Ini hanya perlu dilakukan sekali.
                  </p>
                </div>
              </div>
              <SeedAccountingButton />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default: bulan ini
  const now  = new Date();
  const from = p.dateFrom ? new Date(p.dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to   = p.dateTo   ? new Date(p.dateTo + 'T23:59:59') : new Date();

  const report = await getProfitLossReport(storeId, { from, to });
  const isProfit = report.netProfit >= 0;

  const periodLabel = `${from.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} – ${to.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`;

  return (
    <div className="space-y-5">

      {/* Filter tanggal */}
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">Periode: {periodLabel}</p>
        <div className="flex items-center gap-3 flex-wrap">
        <DateRangeFilter defaultFrom={p.dateFrom} defaultTo={p.dateTo} />
        <BackfillJournalsButton />
      </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Total Pendapatan</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">
              {formatCurrency(report.totalRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Total Beban</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600 shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600">
              {formatCurrency(report.totalExpense)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">
              {isProfit ? 'Laba Bersih' : 'Rugi Bersih'}
            </CardTitle>
            <Minus className={`h-4 w-4 shrink-0 ${isProfit ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(report.netProfit))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isProfit ? '🟢 Untung' : '🔴 Rugi'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detail laporan */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Pendapatan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-green-700">Pendapatan</CardTitle>
          </CardHeader>
          <CardContent>
            {report.revenues.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Belum ada data pendapatan pada periode ini
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {report.revenues.map((r) => (
                    <tr key={r.code}>
                      <td className="py-2.5 pr-2 text-[10px] text-gray-400 font-mono w-10">{r.code}</td>
                      <td className="py-2.5 text-gray-700">{r.name}</td>
                      <td className="py-2.5 text-right font-mono text-green-700 font-medium">
                        {formatCurrency(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-green-200">
                    <td colSpan={2} className="pt-3 text-xs font-semibold text-green-800">Total Pendapatan</td>
                    <td className="pt-3 text-right font-bold font-mono text-green-700">
                      {formatCurrency(report.totalRevenue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Beban */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-red-700">Beban</CardTitle>
          </CardHeader>
          <CardContent>
            {report.expenses.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Belum ada data beban pada periode ini
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {report.expenses.map((e) => (
                    <tr key={e.code}>
                      <td className="py-2.5 pr-2 text-[10px] text-gray-400 font-mono w-10">{e.code}</td>
                      <td className="py-2.5 text-gray-700">{e.name}</td>
                      <td className="py-2.5 text-right font-mono text-red-700 font-medium">
                        {formatCurrency(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-red-200">
                    <td colSpan={2} className="pt-3 text-xs font-semibold text-red-800">Total Beban</td>
                    <td className="pt-3 text-right font-bold font-mono text-red-700">
                      {formatCurrency(report.totalExpense)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ringkasan akhir */}
      <Card className={`border-2 ${isProfit ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}`}>
        <CardContent className="pt-5">
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Total Pendapatan</span>
              <span className="font-mono font-medium text-green-700">{formatCurrency(report.totalRevenue)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>HPP (Harga Pokok Penjualan)</span>
              <span className="font-mono text-red-600">
                ({formatCurrency(report.expenses.find(e => e.code === '5001')?.amount ?? 0)})
              </span>
            </div>
            <div className="flex justify-between text-gray-700 font-medium border-t pt-2">
              <span>Laba Kotor</span>
              <span className="font-mono">{formatCurrency(report.grossProfit)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Beban Operasional</span>
              <span className="font-mono text-red-600">
                ({formatCurrency(
                  report.totalExpense - (report.expenses.find(e => e.code === '5001')?.amount ?? 0)
                )})
              </span>
            </div>
            <div className={`flex justify-between font-bold text-base pt-2.5 border-t-2 ${
              isProfit ? 'border-green-300 text-green-700' : 'border-red-300 text-red-700'
            }`}>
              <span>{isProfit ? '✅ Laba Bersih' : '❌ Rugi Bersih'}</span>
              <span className="font-mono">{formatCurrency(Math.abs(report.netProfit))}</span>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
