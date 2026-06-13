import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { CashflowDialog } from '@/components/cashflow/cashflow-dialog';
import { CashflowTable } from '@/components/cashflow/cashflow-table';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';

async function getCashflowData(params: {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  sort?: string;
}) {
  const { 
    page = 1, 
    limit = 10, 
    search = '', 
    type = 'all',
    sort = 'date_desc'
  } = params;
  
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {};
  
  // Search across description and category
  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' as const } },
      { category: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  // Filter by type
  if (type !== 'all') {
    where.type = type;
  }

  // Build orderBy clause
  const orderBy: any = [];
  switch (sort) {
    case 'date_asc':
      orderBy.push({ date: 'asc' });
      break;
    case 'date_desc':
      orderBy.push({ date: 'desc' });
      break;
    case 'amount_asc':
      orderBy.push({ amount: 'asc' });
      break;
    case 'amount_desc':
      orderBy.push({ amount: 'desc' });
      break;
    default:
      orderBy.push({ date: 'desc' });
  }
  
  const [transactions, total] = await Promise.all([
    db.cashflow.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        createdBy: {
          select: {
            name: true,
          },
        },
      },
    }),
    db.cashflow.count({ where }),
  ]);

  return {
    transactions: transactions.map((t: typeof transactions[number]) => ({
      ...t,
      amount: Number(t.amount),
    })),
    total,
  };
}

async function getCashflowStats() {
  const [totalIncome, totalExpense] = await Promise.all([
    db.cashflow.aggregate({
      where: { type: 'INCOME' },
      _sum: { amount: true },
    }),
    db.cashflow.aggregate({
      where: { type: 'EXPENSE' },
      _sum: { amount: true },
    }),
  ]);

  const income = Number(totalIncome._sum.amount || 0);
  const expense = Number(totalExpense._sum.amount || 0);
  const balance = income - expense;

  return { income, expense, balance };
}

export default async function AdminCashflowPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    page?: string; 
    limit?: string;
    search?: string;
    type?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 10;
  const search = params.search || '';
  const type = params.type || 'all';
  const sort = params.sort || 'date_desc';

  const { transactions, total } = await getCashflowData({ page, limit, search, type, sort });
  const stats = await getCashflowStats();

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex justify-between items-center">
        {/* Desktop button — hidden on mobile */}
        <div className="hidden sm:block">
          <CashflowDialog />
        </div>
      </div>

      {/* Mobile FAB */}
      <div className="sm:hidden fixed bottom-24 right-6 z-40">
        <CashflowDialog
          trigger={
            <button className="w-12 h-12 rounded-full bg-[#028697] text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          }
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Pemasukan</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-green-600">
              {formatCurrency(stats.income)}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Total pendapatan</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Pengeluaran</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-red-600">
              {formatCurrency(stats.expense)}
            </div>
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
      {/* <div className={`text-xs md:text-sm font-medium ${stats.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        <p>Bagi hasil system (10%) • {stats.balance >= 0 ? formatCurrency(stats.balance/10) : formatCurrency(0)}</p>
      </div> */}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Riwayat Transaksi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search & Filter Bar */}
          <SearchFilterBar
            searchPlaceholder="Search by description or category..."
            filters={[
              {
                key: 'type',
                label: 'Transaction Type',
                defaultValue: 'all',
                options: [
                  { value: 'all', label: 'All Types' },
                  { value: 'INCOME', label: 'Income' },
                  { value: 'EXPENSE', label: 'Expense' },
                ],
              },
            ]}
            sortOptions={[
              { value: 'date_desc', label: 'Newest First' },
              { value: 'date_asc', label: 'Oldest First' },
              { value: 'amount_desc', label: 'Highest Amount' },
              { value: 'amount_asc', label: 'Lowest Amount' },
            ]}
            defaultSort="date_desc"
          />

          {/* Cashflow Table */}
          <CashflowTable 
            transactions={transactions}
            currentPage={page}
            pageSize={limit}
            totalItems={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}