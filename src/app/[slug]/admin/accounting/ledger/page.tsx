import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { getLedger } from '@/modules/accounting/lib/accounting-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DateRangeFilter } from '@/components/accounting/date-range-filter';
import { LedgerAccountFilter } from '@/components/accounting/ledger-account-filter';
import { formatCurrency } from '@/lib/utils';

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  ASSET:     'Aset',
  LIABILITY: 'Liabilitas',
  EQUITY:    'Ekuitas',
  REVENUE:   'Pendapatan',
  EXPENSE:   'Beban',
};

const ACCOUNT_TYPE_COLOR: Record<string, string> = {
  ASSET:     'border-blue-200 text-blue-700 bg-blue-50',
  LIABILITY: 'border-orange-200 text-orange-700 bg-orange-50',
  EQUITY:    'border-purple-200 text-purple-700 bg-purple-50',
  REVENUE:   'border-green-200 text-green-700 bg-green-50',
  EXPENSE:   'border-red-200 text-red-700 bg-red-50',
};

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string; account?: string }>;
}) {
  const p = await searchParams;
  const { storeId } = await getStoreContext();

  const now  = new Date();
  const from = p.dateFrom ? new Date(p.dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to   = p.dateTo   ? new Date(p.dateTo + 'T23:59:59') : new Date();

  const [accounts, ledger] = await Promise.all([
    db.account.findMany({
      where:   { storeId, isActive: true },
      orderBy: { code: 'asc' },
      select:  { code: true, name: true },
    }),
    getLedger(storeId, { from, to }, p.account || undefined),
  ]);

  return (
    <div className="space-y-5">

      {/* Filter */}
      <div className="space-y-3">
        <DateRangeFilter defaultFrom={p.dateFrom} defaultTo={p.dateTo} />
        <LedgerAccountFilter accounts={accounts} currentAccount={p.account} />
      </div>

      {/* Akun-akun */}
      {ledger.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada transaksi pada periode dan akun yang dipilih.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {ledger.map((account) => (
            <Card key={account.code}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{account.code}</span>
                    <CardTitle className="text-sm">{account.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${ACCOUNT_TYPE_COLOR[account.type]}`}
                    >
                      {ACCOUNT_TYPE_LABEL[account.type]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      Total D:{' '}
                      <span className="font-mono text-blue-700 font-medium">
                        {formatCurrency(account.totalDebit)}
                      </span>
                    </span>
                    <span>
                      Total K:{' '}
                      <span className="font-mono text-rose-600 font-medium">
                        {formatCurrency(account.totalCredit)}
                      </span>
                    </span>
                    <span className="font-semibold text-gray-700">
                      Saldo:{' '}
                      <span className={`font-mono ${account.endBalance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(account.endBalance))}
                        {account.endBalance < 0 ? ' (K)' : ''}
                      </span>
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-3 font-medium w-24">Tanggal</th>
                        <th className="text-left py-2 pr-3 font-medium">Keterangan</th>
                        <th className="text-right py-2 pr-3 font-medium w-28">Debit</th>
                        <th className="text-right py-2 pr-3 font-medium w-28">Kredit</th>
                        <th className="text-right py-2 font-medium w-28">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {account.lines.map((line, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-2.5 pr-3 text-muted-foreground whitespace-nowrap">
                            {new Date(line.date).toLocaleDateString('id-ID', {
                              day: '2-digit', month: 'short',
                            })}
                          </td>
                          <td className="py-2.5 pr-3 text-gray-700 max-w-[200px] truncate">
                            {line.description}
                            <span className={`ml-1.5 text-[10px] px-1 rounded ${
                              line.sourceType === 'POS_SALE'
                                ? 'text-blue-500 bg-blue-50'
                                : 'text-amber-500 bg-amber-50'
                            }`}>
                              {line.sourceType === 'POS_SALE' ? 'POS' : 'Manual'}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono text-blue-700">
                            {line.debit > 0 ? formatCurrency(line.debit) : '–'}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono text-rose-600">
                            {line.credit > 0 ? formatCurrency(line.credit) : '–'}
                          </td>
                          <td className={`py-2.5 text-right font-mono font-medium ${
                            line.balance >= 0 ? 'text-gray-800' : 'text-red-600'
                          }`}>
                            {formatCurrency(Math.abs(line.balance))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 font-semibold">
                        <td colSpan={2} className="pt-3 text-xs text-gray-600">Total</td>
                        <td className="pt-3 text-right font-mono text-blue-700">
                          {formatCurrency(account.totalDebit)}
                        </td>
                        <td className="pt-3 text-right font-mono text-rose-600">
                          {formatCurrency(account.totalCredit)}
                        </td>
                        <td className={`pt-3 text-right font-mono font-bold ${
                          account.endBalance >= 0 ? 'text-gray-900' : 'text-red-600'
                        }`}>
                          {formatCurrency(Math.abs(account.endBalance))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
