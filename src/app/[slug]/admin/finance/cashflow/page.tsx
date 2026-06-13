import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { CashflowDialog } from '@/components/cashflow/cashflow-dialog';
import { CashflowTable } from '@/components/cashflow/cashflow-table';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';

async function getCashflowData(storeId: string, params: {
  page?: number; limit?: number; search?: string; type?: string; sort?: string;
}) {
  const { page = 1, limit = 10, search = '', type = 'all', sort = 'date_desc' } = params;
  const skip = (page - 1) * limit;
  const where: any = { storeId };

  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' as const } },
      { category:    { contains: search, mode: 'insensitive' as const } },
    ];
  }
  if (type !== 'all') where.type = type;

  const orderBy: any =
    sort === 'date_asc'    ? [{ date: 'asc' }] :
    sort === 'amount_asc'  ? [{ amount: 'asc' }] :
    sort === 'amount_desc' ? [{ amount: 'desc' }] :
    [{ date: 'desc' }];

  const [transactions, total] = await Promise.all([
    db.cashflow.findMany({ where, skip, take: limit, orderBy, include: { createdBy: { select: { name: true } } } }),
    db.cashflow.count({ where }),
  ]);

  return {
    transactions: transactions.map((t) => ({ ...t, amount: Number(t.amount) })),
    total,
  };
}

async function getCashflowStats(storeId: string) {
  const [inc, exp] = await Promise.all([
    db.cashflow.aggregate({ where: { storeId, type: 'INCOME' },  _sum: { amount: true } }),
    db.cashflow.aggregate({ where: { storeId, type: 'EXPENSE' }, _sum: { amount: true } }),
  ]);
  const income  = Number(inc._sum.amount || 0);
  const expense = Number(exp._sum.amount || 0);
  return { income, expense, balance: income - expense };
}

export default async function CashflowPage({ searchParams }: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; type?: string; sort?: string }>;
}) {
  const p = await searchParams;
  const { storeId } = await getStoreContext();

  const [{ transactions, total }, stats] = await Promise.all([
    getCashflowData(storeId, { page: Number(p.page) || 1, limit: Number(p.limit) || 10, search: p.search, type: p.type, sort: p.sort }),
    getCashflowStats(storeId),
  ]);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="hidden sm:block"><CashflowDialog /></div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Pemasukan</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-green-600">{formatCurrency(stats.income)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Total pendapatan</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Pengeluaran</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-red-600">{formatCurrency(stats.expense)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Total biaya</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Profit Bersih</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-xl md:text-2xl font-bold ${stats.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(stats.balance)}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Pendapatan - Pengeluaran</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg md:text-xl">Riwayat Transaksi</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <SearchFilterBar
            searchPlaceholder="Cari berdasarkan deskripsi atau kategori..."
            filters={[{ key: 'type', label: 'Tipe Transaksi', defaultValue: 'all', options: [
              { value: 'all', label: 'Semua Tipe' }, { value: 'INCOME', label: 'Pemasukan' }, { value: 'EXPENSE', label: 'Pengeluaran' },
            ]}]}
            sortOptions={[
              { value: 'date_desc',   label: 'Terbaru' }, { value: 'date_asc',    label: 'Terlama' },
              { value: 'amount_desc', label: 'Jumlah Terbesar' }, { value: 'amount_asc', label: 'Jumlah Terkecil' },
            ]}
            defaultSort="date_desc"
          />
          <CashflowTable transactions={transactions} currentPage={Number(p.page) || 1} pageSize={Number(p.limit) || 10} totalItems={total} />
        </CardContent>
      </Card>
    </div>
  );
}
