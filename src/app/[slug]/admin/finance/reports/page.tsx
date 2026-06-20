import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { ReportTabs } from '@/components/reports/report-tabs';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, Package, DollarSign, AlertTriangle } from 'lucide-react';
import { SalesReportTable } from '@/components/reports/sales-report-table';
import { InventoryReportTable } from '@/components/reports/inventory-report-table';
import { FinancialSummary } from '@/components/reports/financial-summary';
import { PlanGate } from '@/components/plan/plan-gate';
import { ExportButton } from '@/components/reports/export-button';

async function getSalesReport(storeId: string, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const [sales, agg] = await Promise.all([
    db.sale.findMany({
      where: { storeId }, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true, email: true } },
        items: {
          include: {
            variant: {
              select: {
                name: true,
                product: { select: { name: true } },
              },
            },
          },
        },
      },
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
        variant: { name: item.variant.name, product: { name: item.variant.product.name } },
      })),
    })),
    totalRevenue: Number(agg._sum.total || 0),
    totalTransactions: agg._count,
  };
}

async function getInventoryReport(storeId: string, page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  const [inventory, totalProducts] = await Promise.all([
    db.productVariant.findMany({
      where: { storeId }, skip, take: limit,
      include: { product: { select: { name: true } } },
      orderBy: { stock: 'asc' },
    }),
    db.productVariant.count({ where: { storeId } }),
  ]);

  const serialized = inventory.map((i) => ({ ...i, price: Number(i.price), cost: Number(i.cost) }));

  // lowStock comparison done in JS — Prisma cannot compare two fields of the
  // same row directly in a `where` clause without a raw query.
  const lowStockCount = serialized.filter((i) => i.stock <= i.lowStock).length;

  const inventoryValue = serialized.reduce((sum, i) => sum + (i.type !== 'PREORDER' ? i.cost * i.stock : 0), 0);

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

export default async function FinanceReportsPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ salesPage?: string; salesLimit?: string; page?: string; limit?: string; tab?: string }>;
}) {
  const [{ slug }, p] = await Promise.all([params, searchParams]);
  const { storeId, storePlan } = await getStoreContext();

  const [salesData, inventoryData, financialData] = await Promise.all([
    getSalesReport(storeId, Number(p.salesPage) || 1, Number(p.salesLimit) || 10),
    getInventoryReport(storeId, Number(p.page) || 1, Number(p.limit) || 10),
    getFinancialReport(storeId),
  ]);

  const activeTab = p.tab || 'financial';

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Summary cards — 4 even columns */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Pendapatan Penjualan</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500 shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold text-blue-600">{formatCurrency(salesData.totalRevenue)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">{salesData.totalTransactions} transaksi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Laba Bersih</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className={`text-lg md:text-2xl font-bold ${financialData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(financialData.netProfit)}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Pemasukan - Pengeluaran</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Nilai Inventori</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold">{formatCurrency(inventoryData.inventoryValue)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">{inventoryData.totalProducts} varian</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Stok Menipis</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          </CardHeader>
          <CardContent>
            <div className={`text-lg md:text-2xl font-bold ${inventoryData.lowStockCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {inventoryData.lowStockCount}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              {inventoryData.lowStockCount > 0 ? 'Varian perlu restock' : 'Semua stok aman'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs — persisted via ?tab= URL param, driven by a small client wrapper */}
      <ReportTabs activeTab={activeTab}>
        <TabsContent value="financial">
          <div className="flex justify-end mb-3">
            <PlanGate plan={storePlan} storeSlug={slug} feature="Export Excel" description="Upgrade ke PRO untuk export laporan">
              <ExportButton type="cashflow" label="Export Cashflow" />
            </PlanGate>
          </div>
          <FinancialSummary data={financialData} />
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Transaksi Penjualan Terbaru</CardTitle>
              <PlanGate plan={storePlan} storeSlug={slug} feature="Export Excel" description="Upgrade ke PRO untuk export laporan">
                <ExportButton type="sales" />
              </PlanGate>
            </CardHeader>
            <CardContent>
              <SalesReportTable
                sales={salesData.sales}
                currentPage={Number(p.salesPage) || 1}
                pageSize={Number(p.salesLimit) || 10}
                totalItems={salesData.totalTransactions}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Status Inventori</CardTitle>
              <PlanGate plan={storePlan} storeSlug={slug} feature="Export Excel" description="Upgrade ke PRO untuk export laporan">
                <ExportButton type="inventory" />
              </PlanGate>
            </CardHeader>
            <CardContent>
              <InventoryReportTable
                inventory={inventoryData.inventory}
                currentPage={Number(p.page) || 1}
                pageSize={Number(p.limit) || 10}
                totalItems={inventoryData.totalProducts}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </ReportTabs>
    </div>
  );
}
