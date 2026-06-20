import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { CashflowTable } from '@/components/cashflow/cashflow-table';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';
import { CashflowActions } from '@/components/page-actions/cashflow-actions';

async function getCashflowData(storeId: string, params: {
  page?: number; limit?: number; search?: string; type?: string; sort?: string;
  dateFrom?: string; dateTo?: string;
}) {
  const { page = 1, limit = 10, search = '', type = 'all', sort = 'date_desc', dateFrom, dateTo } = params;
  const skip = (page - 1) * limit;
  const where: any = { storeId };

  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' as const } },
      { category:    { contains: search, mode: 'insensitive' as const } },
    ];
  }
  if (type !== 'all') where.type = type;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo)   where.date.lte = new Date(dateTo + 'T23:59:59');
  }

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

async function getCashflowStats(storeId: string, dateFrom?: string, dateTo?: string) {
  const dateFilter: any = {};
  if (dateFrom || dateTo) {
    dateFilter.date = {};
    if (dateFrom) dateFilter.date.gte = new Date(dateFrom);
    if (dateTo)   dateFilter.date.lte = new Date(dateTo + 'T23:59:59');
  }

  const [inc, exp] = await Promise.all([
    db.cashflow.aggregate({ where: { storeId, type: 'INCOME',  ...dateFilter }, _sum: { amount: true } }),
    db.cashflow.aggregate({ where: { storeId, type: 'EXPENSE', ...dateFilter }, _sum: { amount: true } }),
  ]);
  const income  = Number(inc._sum.amount || 0);
  const expense = Number(exp._sum.amount || 0);
  return { income, expense, balance: income - expense };
}

// Get distinct categories for the combobox (manual entries only, excludes sale-generated categories)
async function getCashflowCategories(storeId: string): Promise<string[]> {
  const rows = await db.cashflow.findMany({
    where: { storeId, saleId: null },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category);
}

export default async function CashflowPage({ searchParams }: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; type?: string; sort?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const p = await searchParams;
  const { storeId } = await getStoreContext();

  const [{ transactions, total }, stats, existingCategories] = await Promise.all([
    getCashflowData(storeId, {
      page: Number(p.page) || 1,
      limit: Number(p.limit) || 10,
      search: p.search,
      type: p.type,
      sort: p.sort,
      dateFrom: p.dateFrom,
      dateTo: p.dateTo,
    }),
    getCashflowStats(storeId, p.dateFrom, p.dateTo),
    getCashflowCategories(storeId),
  ]);

  const isFiltered = !!(p.dateFrom || p.dateTo);

  return (
    <div className="space-y-6 md:space-y-8">
      <CashflowActions existingCategories={existingCategories} />

      {/* Stats — scoped to current date filter */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Pemasukan</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-green-600">{formatCurrency(stats.income)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">{isFiltered ? 'Periode yang dipilih' : 'Semua waktu'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Pengeluaran</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-red-600">{formatCurrency(stats.expense)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">{isFiltered ? 'Periode yang dipilih' : 'Semua waktu'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Saldo Bersih</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-xl md:text-2xl font-bold ${stats.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(stats.balance)}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">{isFiltered ? 'Periode yang dipilih' : 'Pemasukan - Pengeluaran'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base md:text-lg">Riwayat Transaksi</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <SearchFilterBar
            searchPlaceholder="Cari deskripsi atau kategori..."
            filters={[{ key: 'type', label: 'Tipe Transaksi', defaultValue: 'all', options: [
              { value: 'all', label: 'Semua Tipe' },
              { value: 'INCOME', label: 'Pemasukan' },
              { value: 'EXPENSE', label: 'Pengeluaran' },
            ]}]}
            sortOptions={[
              { value: 'date_desc',   label: 'Terbaru' },
              { value: 'date_asc',    label: 'Terlama' },
              { value: 'amount_desc', label: 'Jumlah Terbesar' },
              { value: 'amount_asc',  label: 'Jumlah Terkecil' },
            ]}
            defaultSort="date_desc"
            dateRangeKeys={{ from: 'dateFrom', to: 'dateTo' }}
          />
          <CashflowTable
            transactions={transactions}
            currentPage={Number(p.page) || 1}
            pageSize={Number(p.limit) || 10}
            totalItems={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
