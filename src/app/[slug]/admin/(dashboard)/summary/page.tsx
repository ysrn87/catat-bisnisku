import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Package, ShoppingCart, Users, DollarSign } from 'lucide-react';
import { SalesTrendChart } from '@/components/charts/sales-trend-chart';

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

async function getSalesTrend(storeId: string) {
  const days = 7;
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const sales = await db.sale.findMany({
    where: { storeId, createdAt: { gte: since } },
    select: { total: true, createdAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets.set(d.toDateString(), 0);
  }

  for (const sale of sales) {
    const key = sale.createdAt.toDateString();
    buckets.set(key, (buckets.get(key) ?? 0) + Number(sale.total));
  }

  return Array.from(buckets.entries()).map(([dateKey, total]) => ({
    label: DAY_LABELS[new Date(dateKey).getDay()],
    total,
  }));
}

async function getDashboardStats(storeId: string) {
  const [totalProducts, totalSales, totalCustomers, lowStockItems, salesAgg, cashflowAgg] =
    await Promise.all([
      db.productVariant.count({ where: { storeId } }),
      db.sale.count({ where: { storeId } }),
      db.storeUser.count({ where: { storeId } }),
      // FIX: lowStock → lowStockAt
      db.productVariant.count({ where: { storeId, stock: { lte: db.productVariant.fields.lowStockAt } } }),
      db.sale.aggregate({ where: { storeId }, _sum: { total: true } }),
      db.cashflow.aggregate({ where: { storeId, type: 'INCOME' }, _sum: { amount: true } }),
    ]);

  return {
    totalProducts, totalSales, totalCustomers, lowStockItems,
    totalRevenue: Number(salesAgg._sum.total    || 0),
    totalIncome:  Number(cashflowAgg._sum.amount || 0),
  };
}

async function getRecentActivity(storeId: string) {
  const [recentSales, lowStockProducts] = await Promise.all([
    db.sale.findMany({
      where: { storeId }, take: 5, orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } } },
    }),
    // FIX: lowStock → lowStockAt
    db.productVariant.findMany({
      where: { storeId, stock: { lte: db.productVariant.fields.lowStockAt } },
      include: { product: true }, take: 5,
    }),
  ]);
  return { recentSales, lowStockProducts };
}

export default async function RingkasanPage() {
  const { storeId } = await getStoreContext();

  const [stats, { recentSales, lowStockProducts }, salesTrend] = await Promise.all([
    getDashboardStats(storeId),
    getRecentActivity(storeId),
    getSalesTrend(storeId),
  ]);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="col-span-2 lg:col-span-1 order-4 lg:order-1 lg:border-0 lg:bg-[#028697] lg:shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium lg:text-white/80">Pendapatan</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0 lg:hidden" />
            <div className="hidden lg:flex w-7 h-7 rounded-lg bg-white/15 items-center justify-center flex-shrink-0">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-base md:text-2xl font-bold break-all leading-tight lg:text-white lg:text-[1.6rem]">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 lg:text-white/70">Total pendapatan penjualan</p>
          </CardContent>
        </Card>
        <Card className="order-1 lg:order-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-xs md:text-sm font-medium">Total Varian Produk</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-xl md:text-2xl font-bold">{stats.totalProducts}</div><p className="text-[10px] md:text-xs text-muted-foreground">Varian produk di stok</p></CardContent>
        </Card>
        <Card className="order-2 lg:order-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-xs md:text-sm font-medium">Total Penjualan</CardTitle><ShoppingCart className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-xl md:text-2xl font-bold">{stats.totalSales}</div><p className="text-[10px] md:text-xs text-muted-foreground">Transaksi selesai</p></CardContent>
        </Card>
        <Card className="order-3 lg:order-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-xs md:text-sm font-medium">Total Pelanggan</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-xl md:text-2xl font-bold">{stats.totalCustomers}</div><p className="text-[10px] md:text-xs text-muted-foreground">Member terdaftar</p></CardContent>
        </Card>
      </div>

      <div className="hidden lg:block">
        <Card>
          <CardHeader><CardTitle className="text-base font-medium">Tren penjualan 7 hari terakhir</CardTitle></CardHeader>
          <CardContent>
            <SalesTrendChart data={salesTrend} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base md:text-lg">Penjualan Terbaru</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 md:space-y-4">
              {recentSales.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada penjualan</p> : (
                recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="text-xs font-semibold truncate">{sale.customer?.name || 'Pelanggan Umum'}</p>
                      <p className="text-xs text-muted-foreground italic truncate">{sale.saleNumber}</p>
                    </div>
                    <div className="text-xs font-medium flex-shrink-0">{formatCurrency(Number(sale.total))}</div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base md:text-lg">Stok Menipis ({stats.lowStockItems})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 md:space-y-4">
              {lowStockProducts.length === 0 ? <p className="text-sm text-muted-foreground">Semua stok tersedia</p> : (
                lowStockProducts.map((variant) => (
                  <div key={variant.id} className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="text-sm font-medium truncate">{variant.product.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{variant.name}</p>
                    </div>
                    <div className="text-sm font-medium text-red-600 flex-shrink-0">{variant.stock} tersisa</div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
