import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Package, ShoppingCart, Users, DollarSign } from 'lucide-react';
import { DashboardTabs } from '@/components/pos/dashboard-tabs';
import { PosPanel } from '@/components/pos/pos-panel';
import { getPointsConversionRate } from '@/actions/settings';

async function getManagerStats(storeId: string) {
  const [totalProducts, totalSales, totalCustomers, lowStockItems, salesAgg] = await Promise.all([
    db.productVariant.count({ where: { storeId } }),
    db.sale.count({ where: { storeId } }),
    db.storeUser.count({ where: { storeId, role: 'MEMBER' } }),
    // FIX: lowStock → lowStockAt
    db.productVariant.count({ where: { storeId, stock: { lte: db.productVariant.fields.lowStockAt } } }),
    db.sale.aggregate({ where: { storeId }, _sum: { total: true } }),
  ]);

  return { totalProducts, totalSales, totalCustomers, lowStockItems, totalRevenue: Number(salesAgg._sum.total || 0) };
}

async function getRecentActivity(storeId: string) {
  const [recentSales, lowStockProducts] = await Promise.all([
    db.sale.findMany({ where: { storeId }, take: 5, orderBy: { createdAt: 'desc' }, include: { customer: { select: { name: true } } } }),
    // FIX: lowStock → lowStockAt
    db.productVariant.findMany({ where: { storeId, stock: { lte: db.productVariant.fields.lowStockAt } }, include: { product: true }, take: 5 }),
  ]);
  return { recentSales, lowStockProducts };
}

async function getPosVariants(storeId: string) {
  const variants = await db.productVariant.findMany({
    where: { storeId, isActive: true, product: { isActive: true }, OR: [{ stock: { gt: 0 } }, { type: 'PREORDER' }] },
    include: { product: { select: { name: true, categoryId: true } } },
    orderBy: { product: { name: 'asc' } },
  });

  const categoryIds = [...new Set(variants.map(v => v.product.categoryId).filter((id): id is string => !!id))];
  const categories  = categoryIds.length ? await db.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true, icon: true, color: true } }) : [];
  const catMap      = new Map(categories.map(c => [c.id, c]));

  return variants.map((v) => {
    const cat = v.product.categoryId ? catMap.get(v.product.categoryId) ?? null : null;
    return {
      id: v.id, name: v.name, price: Number(v.price), stock: v.stock,
      pointsPerUnit: v.pointsPerUnit, // FIX: points → pointsPerUnit
      barcode: v.barcode ?? null, type: v.type,
      product:  { name: v.product.name },
      category: cat ? { name: cat.name, icon: cat.icon ?? null, color: cat.color ?? null } : null,
    };
  });
}

async function getMembers(storeId: string) {
  const storeUsers = await db.storeUser.findMany({ where: { storeId, role: 'MEMBER' }, include: { user: { select: { id: true, name: true } } } });
  // FIX: id harus StoreUser.id (dipakai sebagai memberId), bukan User.id
  return storeUsers.map((su) => ({ id: su.id, name: su.user.name, points: su.points }));
}

async function getNonMembers(storeId: string) {
  const customers = await db.customer.findMany({
    where: { storeId },
    select: { id: true, name: true, phone: true, address: true },
    orderBy: { name: 'asc' },
  });
  return customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? '', address: c.address ?? null }));
}

export default async function ManagerDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { storeId } = await getStoreContext();

  const [stats, { recentSales, lowStockProducts }, posVariants, members, nonMembers, conversionRate, store, session] =
    await Promise.all([
      getManagerStats(storeId), getRecentActivity(storeId), getPosVariants(storeId),
      getMembers(storeId), getNonMembers(storeId), getPointsConversionRate(),
      db.store.findUnique({ where: { id: storeId }, select: { name: true } }),
      auth(),
    ]);

  const RingkasanContent = (
    <div className="space-y-6 md:space-y-8">
      <div className="hidden md:block">
        <h1 className="text-2xl md:text-3xl font-bold">Ringkasan Manager</h1>
        <p className="text-sm md:text-base text-gray-600 mt-1">Selamat datang! Berikut ringkasan toko kamu.</p>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-xs md:text-sm font-medium">Total Varian Produk</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl md:text-2xl font-bold">{stats.totalProducts}</div><p className="text-[10px] md:text-xs text-muted-foreground">Varian produk di stok</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-xs md:text-sm font-medium">Total Penjualan</CardTitle><ShoppingCart className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl md:text-2xl font-bold">{stats.totalSales}</div><p className="text-[10px] md:text-xs text-muted-foreground">Transaksi selesai</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-xs md:text-sm font-medium">Total Pelanggan</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl md:text-2xl font-bold">{stats.totalCustomers}</div><p className="text-[10px] md:text-xs text-muted-foreground">Member terdaftar</p></CardContent></Card>
        <Card className="col-span-2 lg:col-span-1"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-xs md:text-sm font-medium">Pendapatan</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" /></CardHeader><CardContent><div className="text-base md:text-2xl font-bold break-all leading-tight">{formatCurrency(stats.totalRevenue)}</div><p className="text-[10px] md:text-xs text-muted-foreground mt-1">Total pendapatan penjualan</p></CardContent></Card>
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

  const PosContent = (
    <PosPanel variants={posVariants} members={members} walkInCustomers={nonMembers} conversionRate={conversionRate} storeSlug={slug} storeName={store?.name ?? 'Toko'} cashierName={session?.user?.name ?? undefined} />
  );

  return <DashboardTabs ringkasanContent={RingkasanContent} posContent={PosContent} />;
}
