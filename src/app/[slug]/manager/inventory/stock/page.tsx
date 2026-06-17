import { db } from '@/lib/db';
import { getStoreContext, PLAN_LIMITS } from '@/lib/store-context';
import { PlanGate } from '@/components/plan/plan-gate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, AlertTriangle } from 'lucide-react';
import { StockTable } from '@/components/stock/stock-table';
import { StockMovementsTable } from '@/components/stock/stock-movements-table';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';

async function getStockData(storeId: string) {
  const [totalVariants, lowStockCount, stockValue] = await Promise.all([
    db.productVariant.count({ where: { storeId } }),
    db.productVariant.count({ where: { storeId, stock: { lte: db.productVariant.fields.lowStock } } }),
    db.productVariant.aggregate({ where: { storeId }, _sum: { stock: true } }),
  ]);
  return { totalVariants, lowStockCount, totalStock: stockValue._sum.stock || 0 };
}

async function getAllStock(storeId: string, params: { page?: number; limit?: number; search?: string; stockLevel?: string; sort?: string }) {
  const { page = 1, limit = 10, search = '', stockLevel = 'all', sort = 'stock_asc' } = params;
  const skip = (page - 1) * limit;
  const where: any = { storeId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' as const } },
      { sku: { contains: search, mode: 'insensitive' as const } },
      { product: { name: { contains: search, mode: 'insensitive' as const } } },
    ];
  }

  if (stockLevel === 'low')    where.stock = { lte: db.productVariant.fields.lowStock };
  if (stockLevel === 'normal') where.stock = { gt: db.productVariant.fields.lowStock };
  if (stockLevel === 'out')    where.stock = { equals: 0 };

  const orderBy: any = [];
  if (sort === 'stock_desc') orderBy.push({ stock: 'desc' });
  else if (sort === 'name_asc')  orderBy.push({ product: { name: 'asc' } });
  else if (sort === 'name_desc') orderBy.push({ product: { name: 'desc' } });
  else orderBy.push({ stock: 'asc' });

  const [items, total] = await Promise.all([
    db.productVariant.findMany({ where, skip, take: limit, include: { product: true }, orderBy }),
    db.productVariant.count({ where }),
  ]);

  return {
    items: items.map((i) => ({ ...i, price: Number(i.price), cost: Number(i.cost) })),
    total,
  };
}

async function getStockMovements(storeId: string, params: { page?: number; limit?: number; search?: string; type?: string; sort?: string }) {
  const { page = 1, limit = 10, search = '', type = 'all', sort = 'date_desc' } = params;
  const skip = (page - 1) * limit;
  const where: any = { storeId };

  if (search) {
    where.OR = [
      { variant: { name: { contains: search, mode: 'insensitive' as const } } },
      { variant: { product: { name: { contains: search, mode: 'insensitive' as const } } } },
      { notes: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  if (type !== 'all') where.type = type;

  const orderBy = sort === 'date_asc' ? [{ createdAt: 'asc' as const }] : [{ createdAt: 'desc' as const }];

  const [movements, total] = await Promise.all([
    db.stockMovement.findMany({ where, skip, take: limit, orderBy, include: { variant: { include: { product: true } } } }),
    db.stockMovement.count({ where }),
  ]);

  return {
    movements: movements.map((m) => ({
      id: m.id, type: m.type, quantity: m.quantity, notes: m.notes, createdAt: m.createdAt,
      variant: { name: m.variant.name, product: { name: m.variant.product.name } },
    })),
    total,
  };
}

export default async function StockPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; limit?: string; search?: string; stockLevel?: string; sort?: string; movementPage?: string; movementLimit?: string; movementSearch?: string; movementType?: string; movementSort?: string }>;
}) {
  const [{ slug }, p] = await Promise.all([params, searchParams]);
  const { storeId, storePlan } = await getStoreContext();

  const [stats, { items, total }, { movements, total: movTotal }] = await Promise.all([
    getStockData(storeId),
    getAllStock(storeId, { page: Number(p.page) || 1, limit: Number(p.limit) || 10, search: p.search, stockLevel: p.stockLevel, sort: p.sort }),
    getStockMovements(storeId, { page: Number(p.movementPage) || 1, limit: Number(p.movementLimit) || 10, search: p.movementSearch, type: p.movementType, sort: p.movementSort }),
  ]);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="grid gap-3 md:gap-4 grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Produk</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{stats.totalVariants}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Varian produk</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Stok Kurang</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-red-600">{stats.lowStockCount}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Butuh pembaruan</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Stok</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{stats.totalStock}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Total unit</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm md:text-xl">Ketersediaan Item</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <SearchFilterBar
            searchPlaceholder="Cari produk atau varian..."
            filters={[{ key: 'stockLevel', label: 'Level Stok', defaultValue: 'all', options: [
              { value: 'all', label: 'Semua' }, { value: 'low', label: 'Stok Sedikit' },
              { value: 'normal', label: 'Stok Normal' }, { value: 'out', label: 'Habis' },
            ]}]}
            sortOptions={[
              { value: 'stock_asc', label: 'Stok Terkecil' }, { value: 'stock_desc', label: 'Stok Terbesar' },
              { value: 'name_asc', label: 'Nama A-Z' }, { value: 'name_desc', label: 'Nama Z-A' },
            ]}
            defaultSort="stock_asc"
          />
          <StockTable stockItems={items} currentPage={Number(p.page) || 1} pageSize={Number(p.limit) || 10} totalItems={total} />
        </CardContent>
      </Card>

      <PlanGate
        plan={storePlan}
        storeSlug={slug}
        feature="Riwayat Stok Masuk-Keluar"
        description="Upgrade ke PRO untuk melihat riwayat lengkap sirkulasi barang"
      >
        <Card>
          <CardHeader><CardTitle className="text-lg md:text-xl">Riwayat Sirkulasi Barang</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <SearchFilterBar
              searchPlaceholder="Cari riwayat stok..."
              filters={[{ key: 'movementType', label: 'Tipe', defaultValue: 'all', options: [
                { value: 'all', label: 'Semua' }, { value: 'IN', label: 'Masuk' },
                { value: 'OUT', label: 'Keluar' }, { value: 'ADJUSTMENT', label: 'Penyesuaian' },
              ]}]}
              sortOptions={[{ value: 'date_desc', label: 'Terbaru' }, { value: 'date_asc', label: 'Terlama' }]}
              defaultSort="date_desc"
            />
            <StockMovementsTable movements={movements} currentPage={Number(p.movementPage) || 1} pageSize={Number(p.movementLimit) || 10} totalItems={movTotal} />
          </CardContent>
        </Card>
      </PlanGate>
    </div>
  );
}
