import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, Package, DollarSign } from 'lucide-react';
import { SalesReportTable } from '@/components/reports/sales-report-table';
import { InventoryReportTable } from '@/components/reports/inventory-report-table';
import { FinancialSummary } from '@/components/reports/financial-summary';

async function getSalesReport(storeId: string, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const [sales, agg] = await Promise.all([
    db.sale.findMany({
      where: { storeId }, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true, email: true } }, items: { include: { variant: { include: { product: true } } } } },
    }),
    db.sale.aggregate({ where: { storeId }, _sum: { total: true }, _count: true }),
  ]);

  return {
    sales: sales.map((sale) => ({
      ...sale,
      subtotal: Number(sale.subtotal), discount: Number(sale.discount),
      tax: Number(sale.tax), ongkir: Number((sale as any).ongkir ?? 0), total: Number(sale.total),
      items: sale.items.map((item) => ({
        ...item, price: Number(item.price), subtotal: Number(item.subtotal),
        variant: { ...item.variant, price: Number(item.variant.price), cost: Number(item.variant.cost) },
      })),
    })),
    totalRevenue: Number(agg._sum.total || 0),
    totalTransactions: agg._count,
  };
}

async function getInventoryReport(storeId: string, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const [inventory, totalProducts, lowStockCount] = await Promise.all([
    db.productVariant.findMany({ where: { storeId }, skip, take: limit, include: { product: true }, orderBy: { stock: 'asc' } }),
    db.productVariant.count({ where: { storeId } }),
    db.productVariant.count({ where: { storeId, stock: { lte: db.productVariant.fields.lowStock } } }),
  ]);

  const serialized = inventory.map((i) => ({ ...i, price: Number(i.price), cost: Number(i.cost) }));
  const inventoryValue = serialized.reduce((sum, i) => sum + i.cost * i.stock, 0);

  return { inventory: serialized, totalProducts, lowStockCount, inventoryValue };
}

async function getFinancialReport(storeId: string) {
  const [income, expenses, sales] = await Promise.all([
    db.cashflow.aggregate({ where: { storeId, type: 'INCOME' },  _sum: { amount: true } }),
    db.cashflow.aggregate({ where: { storeId, type: 'EXPENSE' }, _sum: { amount: true } }),
    db.sale.aggregate(       { where: { storeId },                _sum: { total: true } }),
  ]);

  const totalIncome       = Number(income._sum.amount   || 0);
  const totalExpenses     = Number(expenses._sum.amount || 0);
  const totalSalesRevenue = Number(sales._sum.total     || 0);
  return { totalIncome, totalExpenses, totalSalesRevenue, netProfit: totalIncome - totalExpenses };
}

export default async function FinanceReportsPage({ searchParams }: {
  searchParams: Promise<{ salesPage?: string; salesLimit?: string; page?: string; limit?: string }>;
}) {
  const p = await searchParams;
  const { storeId } = await getStoreContext();

  const [salesData, inventoryData, financialData] = await Promise.all([
    getSalesReport(storeId, Number(p.salesPage) || 1, Number(p.salesLimit) || 10),
    getInventoryReport(storeId, Number(p.page) || 1, Number(p.limit) || 10),
    getFinancialReport(storeId),
  ]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendapatan Penjualan</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(salesData.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">{salesData.totalTransactions} transaksi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laba Bersih</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${financialData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(financialData.netProfit)}
            </div>
            <p className="text-xs text-muted-foreground">Pemasukan - Pengeluaran</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nilai Inventori</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(inventoryData.inventoryValue)}</div>
            <p className="text-xs text-muted-foreground">{inventoryData.totalProducts} produk</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="financial" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="financial">Keuangan</TabsTrigger>
          <TabsTrigger value="sales">Penjualan</TabsTrigger>
          <TabsTrigger value="inventory">Inventori</TabsTrigger>
        </TabsList>
        <TabsContent value="financial"><FinancialSummary data={financialData} /></TabsContent>
        <TabsContent value="sales">
          <Card>
            <CardHeader><CardTitle>Transaksi Penjualan Terbaru</CardTitle></CardHeader>
            <CardContent>
              <SalesReportTable sales={salesData.sales} currentPage={Number(p.salesPage) || 1} pageSize={Number(p.salesLimit) || 10} totalItems={salesData.totalTransactions} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="inventory">
          <Card>
            <CardHeader><CardTitle>Status Inventori</CardTitle></CardHeader>
            <CardContent>
              <InventoryReportTable inventory={inventoryData.inventory} currentPage={Number(p.page) || 1} pageSize={Number(p.limit) || 10} totalItems={inventoryData.totalProducts} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
