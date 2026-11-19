import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { Package } from 'lucide-react';
import { InventoryReportTable } from '@/components/reports/inventory-report-table';
import { PlanGate } from '@/components/plan/plan-gate';
import { ExportButton } from '@/components/reports/export-button';
import { getInventoryTotals } from '@/lib/inventory-totals';

async function getInventoryReport(storeId: string, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const [inventory, totalProducts, totals] = await Promise.all([
    db.productVariant.findMany({ where: { storeId }, skip, take: limit, include: { product: true }, orderBy: { stock: 'asc' } }),
    db.productVariant.count({ where: { storeId } }),
    // Total SELURUH varian (kartu ringkasan), bukan hanya baris di halaman ini
    getInventoryTotals(storeId),
  ]);

  const serialized = inventory.map((i) => ({ ...i, price: Number(i.price), cost: Number(i.cost) }));

  return {
    inventory: serialized,
    totalProducts,
    lowStockCount:  totals.lowStockCount,
    inventoryValue: totals.inventoryValue,
    inventoryPrice: totals.inventoryPrice,
  };
}

export default async function InventoryReportsPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  const [{ slug }, p] = await Promise.all([params, searchParams]);
  const { storeId, storePlan } = await getStoreContext();
  const page  = Math.max(1, Math.floor(Number(p.page)) || 1);
  const limit = Math.min(100, Math.max(1, Math.floor(Number(p.limit)) || 10));
  const data  = await getInventoryReport(storeId, page, limit);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Nilai Inventori</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(data.inventoryValue)}</div><p className="text-xs text-muted-foreground">{data.totalProducts} produk</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Estimasi Harga Jual</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(data.inventoryPrice)}</div><p className="text-xs text-muted-foreground">{data.totalProducts} produk</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Stok Menipis</CardTitle><Package className="h-4 w-4 text-red-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{data.lowStockCount}</div><p className="text-xs text-muted-foreground">Butuh penambahan</p></CardContent></Card>
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="inventory">Inventori</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium">Status Inventori</CardTitle>
              <PlanGate plan={storePlan} storeSlug={slug} feature="Export Excel" description="Upgrade ke PRO untuk export laporan inventori">
                <ExportButton type="inventory" />
              </PlanGate>
            </CardHeader>
            <CardContent>
              <InventoryReportTable inventory={data.inventory} currentPage={page} pageSize={limit} totalItems={data.totalProducts} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
