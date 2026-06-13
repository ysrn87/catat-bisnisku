import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';
import { RecapTable, RecapRow } from '@/components/sales/recap-table';
import { ShoppingBag, TrendingUp, Receipt, BarChart2 } from 'lucide-react';

function getDateRange(period: string): { gte?: Date; lte?: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  switch (period) {
    case 'today': return { gte: startOfDay(now) };
    case 'week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      return { gte: new Date(now.getFullYear(), now.getMonth(), diff) };
    }
    case 'month':      return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    case 'last_month': return {
      gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      lte: new Date(now.getFullYear(), now.getMonth(), 0),
    };
    case 'year': return { gte: new Date(now.getFullYear(), 0, 1) };
    default:     return {};
  }
}

async function getProducts() {
  return db.product.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

async function getRecapData(params: {
  search?: string;
  period?: string;
  paymentStatus?: string;
  productId?: string;
  sort?: string;
}) {
  const {
    search = '',
    period = 'month',
    paymentStatus = 'all',
    productId = 'all',
    sort = 'qty_desc',
  } = params;

  const dateRange = getDateRange(period);

  const saleWhere: Record<string, unknown> = {};
  if (dateRange.gte || dateRange.lte) saleWhere.createdAt = dateRange;
  if (paymentStatus !== 'all') saleWhere.paymentStatus = paymentStatus;

  const variantWhere: Record<string, unknown> = {};
  if (productId !== 'all') variantWhere.productId = productId;
  if (search) {
    variantWhere.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { product: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const items = await db.saleItem.findMany({
    where: {
      sale: saleWhere,
      ...(Object.keys(variantWhere).length > 0 ? { variant: variantWhere } : {}),
    },
    include: {
      variant: { include: { product: true } },
    },
  });

  const map = new Map<string, RecapRow>();

  for (const item of items) {
    const { variant } = item;
    const existing = map.get(variant.id);
    const qty = item.quantity;
    const subtotal = Number(item.subtotal);

    if (existing) {
      existing.totalQty += qty;
      existing.totalRevenue += subtotal;
      existing.totalTransactions += 1;
      existing.avgPrice = existing.totalRevenue / existing.totalQty;
    } else {
      map.set(variant.id, {
        variantId: variant.id,
        productName: variant.product.name,
        variantName: variant.name,
        sku: variant.sku,
        totalQty: qty,
        totalRevenue: subtotal,
        avgPrice: subtotal / qty,
        totalTransactions: 1,
      });
    }
  }

  let rows = Array.from(map.values());

  switch (sort) {
    case 'qty_desc':     rows.sort((a, b) => b.totalQty - a.totalQty); break;
    case 'qty_asc':      rows.sort((a, b) => a.totalQty - b.totalQty); break;
    case 'revenue_desc': rows.sort((a, b) => b.totalRevenue - a.totalRevenue); break;
    case 'revenue_asc':  rows.sort((a, b) => a.totalRevenue - b.totalRevenue); break;
    case 'name_asc':     rows.sort((a, b) => a.productName.localeCompare(b.productName)); break;
    case 'name_desc':    rows.sort((a, b) => b.productName.localeCompare(a.productName)); break;
    default:             rows.sort((a, b) => b.totalQty - a.totalQty);
  }

  const totalRevenue      = rows.reduce((s, r) => s + r.totalRevenue, 0);
  const totalQty          = rows.reduce((s, r) => s + r.totalQty, 0);
  const totalTransactions = new Set(items.map((i) => i.saleId)).size;
  const topProduct        = rows[0] ?? null;

  return { rows, totalRevenue, totalQty, totalTransactions, topProduct };
}

export default async function RecapPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    period?: string;
    paymentStatus?: string;
    productId?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;

  const [{ rows, totalRevenue, totalQty, totalTransactions, topProduct }, products] =
    await Promise.all([getRecapData(params), getProducts()]);

  const formatRupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-4">
          <SearchFilterBar
            searchPlaceholder="Cari produk atau varian..."
            filters={[
              {
                key: 'period',
                label: 'Periode',
                defaultValue: 'month',
                options: [
                  { value: 'today',      label: 'Hari Ini' },
                  { value: 'week',       label: 'Minggu Ini' },
                  { value: 'month',      label: 'Bulan Ini' },
                  { value: 'last_month', label: 'Bulan Lalu' },
                  { value: 'year',       label: 'Tahun Ini' },
                  { value: 'all',        label: 'Semua Waktu' },
                ],
              },
              {
                key: 'productId',
                label: 'Produk',
                defaultValue: 'all',
                options: [
                  { value: 'all', label: 'Semua Produk' },
                  ...products.map((p) => ({ value: p.id, label: p.name })),
                ],
              },
              {
                key: 'paymentStatus',
                label: 'Status Pembayaran',
                defaultValue: 'all',
                options: [
                  { value: 'all',     label: 'Semua Status' },
                  { value: 'PAID',    label: 'Lunas' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'UNPAID',  label: 'Belum Lunas' },
                ],
              },
            ]}
            sortOptions={[
              { value: 'qty_desc',     label: 'Qty Terbanyak' },
              { value: 'qty_asc',      label: 'Qty Tersedikit' },
              { value: 'revenue_desc', label: 'Pendapatan Tertinggi' },
              { value: 'revenue_asc',  label: 'Pendapatan Terendah' },
              { value: 'name_asc',     label: 'Nama A–Z' },
              { value: 'name_desc',    label: 'Nama Z–A' },
            ]}
            defaultSort="qty_desc"
          />
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="pt-5 pl-3 pr-3 flex h-full items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Receipt className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Jumlah Transaksi</p>
                <p className="font-bold text-sm">{totalTransactions.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pl-3 pr-3 flex h-full items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingBag className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Item Terjual</p>
                <p className="font-bold text-sm">{totalQty.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pl-3 pr-3 flex h-full items-center">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Pendapatan</p>
                <p className="font-bold text-xs">{formatRupiah(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pl-3 pr-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <BarChart2 className="w-4 h-4 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Produk Terlaris</p>
                {topProduct ? (
                  <>
                    <p className="font-semibold text-[10px] line-clamp-2">{topProduct.variantName}</p>
                    <p className="text-[10px] text-amber-500 truncate">{topProduct.productName} - {topProduct.sku}</p>
                  </>
                ) : (
                  <p className="font-bold text-sm">–</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm md:text-xl">Rekap Penjualan per Varian</CardTitle>
        </CardHeader>
        <CardContent>
          <RecapTable rows={rows} pageSize={15} />
        </CardContent>
      </Card>
    </div>
  );
}
