import { db } from '@/lib/db';
import { lowStockWhere } from '@/lib/inventory-totals';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { paymentMethodLabel } from '@/lib/payment';
import {
  Package, ShoppingCart, Users, Wallet, CheckCircle2, Clock, Receipt, AlertTriangle,
} from 'lucide-react';
import { SalesTrendChart, type SalesTrendPoint } from '@/components/charts/sales-trend-chart';
import { RangeFilter } from '@/components/dashboard/range-filter';
import { DateNavigator } from '@/components/dashboard/date-navigator';
import { DeltaBadge } from '@/components/dashboard/delta-badge';
import {
  getRangeWindow, parseDashboardQuery, percentChange, queryToSearch, type DashboardQuery, type RangeWindow,
} from '@/lib/dashboard-range';

type PayStatus = 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED';

// Penjualan lama (sebelum ada tabel Payment) tidak punya baris payment → dianggap lunas.
function statusOf(payment: { status: PayStatus } | null): PayStatus {
  return payment?.status ?? 'PAID';
}

async function getPeriodSales(storeId: string, win: RangeWindow) {
  const [sales, prevSales] = await Promise.all([
    db.sale.findMany({
      where: { storeId, createdAt: { gte: win.start, lt: win.end } },
      select: {
        total: true,
        createdAt: true,
        payment: { select: { status: true, method: true } },
        items: { select: { quantity: true } },
      },
    }),
    db.sale.findMany({
      where: { storeId, createdAt: { gte: win.prevStart, lt: win.prevEnd } },
      select: { total: true, payment: { select: { status: true } } },
    }),
  ]);

  let paidTotal = 0, paidCount = 0, pendingTotal = 0, pendingCount = 0;
  let failedCount = 0, refundedCount = 0, itemsSold = 0;
  const methodTotals = new Map<string, { total: number; count: number }>();
  const bucketMap = new Map<string, { paid: number; pending: number }>();
  win.buckets.forEach((b) => bucketMap.set(b.key, { paid: 0, pending: 0 }));

  const bucketKeyOf = (d: Date): string | null => {
    const t = d.getTime();
    const idx = win.buckets.findIndex((b) => t >= b.start.getTime() && t < b.end.getTime());
    return idx >= 0 ? win.buckets[idx].key : null;
  };

  for (const s of sales) {
    const total = Number(s.total);
    const status = statusOf(s.payment as { status: PayStatus } | null);
    const bucket = bucketMap.get(bucketKeyOf(s.createdAt) ?? '');

    if (status === 'PAID') {
      paidTotal += total; paidCount++;
      itemsSold += s.items.reduce((sum, i) => sum + i.quantity, 0);
      if (bucket) bucket.paid += total;
      const label = paymentMethodLabel(s.payment?.method ?? 'CASH');
      const m = methodTotals.get(label) ?? { total: 0, count: 0 };
      m.total += total; m.count++;
      methodTotals.set(label, m);
    } else if (status === 'PENDING') {
      pendingTotal += total; pendingCount++;
      if (bucket) bucket.pending += total;
    } else if (status === 'FAILED') {
      failedCount++;
    } else if (status === 'REFUNDED') {
      refundedCount++;
    }
  }

  let prevPaidTotal = 0, prevPaidCount = 0, prevPendingTotal = 0;
  for (const s of prevSales) {
    const status = statusOf(s.payment as { status: PayStatus } | null);
    if (status === 'PAID') { prevPaidTotal += Number(s.total); prevPaidCount++; }
    else if (status === 'PENDING') prevPendingTotal += Number(s.total);
  }

  const trend: SalesTrendPoint[] = win.buckets.map((b) => {
    const v = bucketMap.get(b.key)!;
    return { label: b.label, tooltip: b.tooltip, paid: v.paid, pending: v.pending };
  });

  const methods = Array.from(methodTotals.entries())
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.total - a.total);

  return {
    paidTotal, paidCount, pendingTotal, pendingCount, failedCount, refundedCount, itemsSold,
    avgTicket: paidCount > 0 ? paidTotal / paidCount : 0,
    prevPaidTotal, prevPaidCount, prevPendingTotal,
    prevAvgTicket: prevPaidCount > 0 ? prevPaidTotal / prevPaidCount : 0,
    trend, methods,
  };
}

async function getTopProducts(storeId: string, win: RangeWindow) {
  const grouped = await db.saleItem.groupBy({
    by: ['variantId'],
    where: {
      sale: {
        storeId,
        createdAt: { gte: win.start, lt: win.end },
        OR: [{ payment: { is: null } }, { payment: { is: { status: 'PAID' } } }],
      },
    },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 5,
  });
  if (grouped.length === 0) return [];

  const variants = await db.productVariant.findMany({
    where: { id: { in: grouped.map((g) => g.variantId) } },
    select: { id: true, name: true, product: { select: { name: true } } },
  });
  const map = new Map(variants.map((v) => [v.id, v]));

  return grouped.map((g) => {
    const v = map.get(g.variantId);
    return {
      id: g.variantId,
      name: v?.product.name ?? 'Produk',
      variant: v?.name ?? '',
      qty: g._sum.quantity ?? 0,
      revenue: Number(g._sum.subtotal ?? 0),
    };
  });
}

async function getStoreInfo(storeId: string, win: RangeWindow) {
  const [totalVariants, totalCustomers, lowStockItems, lowStockProducts, recentSales] = await Promise.all([
    db.productVariant.count({ where: { storeId } }),
    db.storeUser.count({ where: { storeId } }),
    db.productVariant.count({ where: lowStockWhere(storeId) }),
    db.productVariant.findMany({ where: lowStockWhere(storeId), include: { product: true }, take: 5 }),
    // Penjualan terbaru DI DALAM periode yang dipilih (bukan selalu yang paling baru secara global)
    db.sale.findMany({
      where: { storeId, createdAt: { gte: win.start, lt: win.end } }, take: 5, orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } }, payment: { select: { status: true } } },
    }),
  ]);
  return { totalVariants, totalCustomers, lowStockItems, lowStockProducts, recentSales };
}

function StatusPill({ status }: { status: PayStatus }) {
  const map: Record<PayStatus, { label: string; cls: string }> = {
    PAID:     { label: 'Lunas',    cls: 'bg-green-50 text-green-700' },
    PENDING:  { label: 'Pending',  cls: 'bg-amber-50 text-amber-700' },
    FAILED:   { label: 'Gagal',    cls: 'bg-red-50 text-red-600' },
    REFUNDED: { label: 'Refund',   cls: 'bg-gray-100 text-gray-600' },
  };
  const m = map[status];
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}

export default async function RingkasanPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string; date?: string; from?: string; to?: string }>;
}) {
  const [{ slug }, sp, { storeId }] = await Promise.all([params, searchParams, getStoreContext()]);
  const win = getRangeWindow(parseDashboardQuery(sp ?? {}));
  const base = `/${slug}/admin/summary`;
  const hrefOf = (q: DashboardQuery | null) => (q ? `${base}${queryToSearch(q)}` : null);

  const [period, topProducts, info] = await Promise.all([
    getPeriodSales(storeId, win),
    getTopProducts(storeId, win),
    getStoreInfo(storeId, win),
  ]);

  const totalTx = period.paidCount + period.pendingCount;
  const paidShare = totalTx > 0 ? Math.round((period.paidCount / totalTx) * 100) : 0;
  const methodSum = period.methods.reduce((s, m) => s + m.total, 0);
  const periodHint = win.days === 1 ? 'Per jam · WIB' : `Per hari · ${win.periodText}`;

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Filter periode */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold md:text-lg">{win.title}</h2>
            <p className="text-xs text-muted-foreground">
              {win.title !== win.periodText && `${win.periodText} · `}dibandingkan dengan {win.compareLabel}
            </p>
          </div>
          <RangeFilter slug={slug} win={win} />
        </div>
        <DateNavigator
          slug={slug}
          range={win.range}
          anchorYmd={win.anchorYmd}
          fromYmd={win.startYmd}
          toYmd={win.lastYmd}
          todayYmd={win.todayYmd}
          prevHref={hrefOf(win.prevQuery)}
          nextHref={hrefOf(win.nextQuery)}
          todayHref={hrefOf(win.todayQuery)}
        />
      </div>

      {/* Kartu utama */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Card className="col-span-2 border-0 bg-[#028697] shadow-none lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-white/80 md:text-sm">Omzet (Lunas)</CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
              <Wallet className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="break-all text-2xl font-bold leading-tight text-white md:text-[1.9rem]">
              {formatCurrency(period.paidTotal)}
            </div>
            <DeltaBadge onDark value={percentChange(period.paidTotal, period.prevPaidTotal)} label={win.compareLabel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium md:text-sm">Transaksi Lunas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold md:text-2xl">{period.paidCount}</div>
            <DeltaBadge value={percentChange(period.paidCount, period.prevPaidCount)} label={win.compareLabel} />
          </CardContent>
        </Card>

        <Card className={period.pendingCount > 0 ? 'border-amber-200 bg-amber-50/40' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium md:text-sm">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold md:text-2xl">{period.pendingCount}</div>
            <p className="mt-1 break-all text-[10px] text-muted-foreground md:text-xs">
              {period.pendingCount > 0 ? `${formatCurrency(period.pendingTotal)} belum diterima` : 'Tidak ada tagihan tertunda'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium md:text-sm">Rata-rata / Transaksi</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="break-all text-base font-bold leading-tight md:text-2xl">{formatCurrency(Math.round(period.avgTicket))}</div>
            <DeltaBadge value={percentChange(period.avgTicket, period.prevAvgTicket)} label={win.compareLabel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium md:text-sm">Item Terjual</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold md:text-2xl">{period.itemsSold}</div>
            <p className="mt-1 text-[10px] text-muted-foreground md:text-xs">Dari transaksi lunas</p>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium md:text-sm">Komposisi Status Pembayaran</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              {totalTx > 0 && (
                <>
                  <div className="bg-green-500" style={{ width: `${(period.paidCount / totalTx) * 100}%` }} />
                  <div className="bg-amber-500" style={{ width: `${(period.pendingCount / totalTx) * 100}%` }} />
                </>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground md:text-xs">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" />Lunas {paidShare}%</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Pending {totalTx > 0 ? 100 - paidShare : 0}%</span>
              {(period.failedCount > 0 || period.refundedCount > 0) && (
                <span>
                  {period.failedCount > 0 && `${period.failedCount} gagal`}
                  {period.failedCount > 0 && period.refundedCount > 0 && ' · '}
                  {period.refundedCount > 0 && `${period.refundedCount} refund`}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grafik tren — tampil di semua ukuran layar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-baseline justify-between gap-2 text-base font-medium">
            <span>Tren Penjualan</span>
            <span className="text-[11px] font-normal text-muted-foreground">{periodHint}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SalesTrendChart data={period.trend} />
        </CardContent>
      </Card>

      {/* Metode pembayaran + produk terlaris */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base md:text-lg">Metode Pembayaran</CardTitle></CardHeader>
          <CardContent>
            {period.methods.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pembayaran lunas</p>
            ) : (
              <div className="space-y-3">
                {period.methods.map((m) => (
                  <div key={m.label}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-medium">{m.label} <span className="font-normal text-muted-foreground">· {m.count}x</span></span>
                      <span className="shrink-0 tabular-nums">{formatCurrency(m.total)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-[#028697]" style={{ width: `${methodSum > 0 ? (m.total / methodSum) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base md:text-lg">Produk Terlaris</CardTitle></CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada produk terjual</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#028697]/10 text-xs font-bold text-[#028697]">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      {p.variant && <p className="truncate text-xs text-muted-foreground">{p.variant}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">{p.qty}x</p>
                      <p className="text-[11px] tabular-nums text-muted-foreground">{formatCurrency(p.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Penjualan terbaru + stok menipis */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base md:text-lg">{win.isCurrent ? 'Penjualan Terbaru' : 'Penjualan pada Periode Ini'}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 md:space-y-4">
              {info.recentSales.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada penjualan pada periode ini</p> : (
                info.recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between">
                    <div className="mr-3 min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{sale.customer?.name || 'Pelanggan Umum'}</p>
                      <p className="truncate text-xs italic text-muted-foreground">{sale.saleNumber}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-xs font-medium">{formatCurrency(Number(sale.total))}</span>
                      <StatusPill status={statusOf(sale.payment as { status: PayStatus } | null)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base md:text-lg">Stok Menipis ({info.lowStockItems})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 md:space-y-4">
              {info.lowStockProducts.length === 0 ? <p className="text-sm text-muted-foreground">Semua stok tersedia</p> : (
                info.lowStockProducts.map((variant) => (
                  <div key={variant.id} className="flex items-center justify-between">
                    <div className="mr-3 min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{variant.product.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{variant.name}</p>
                    </div>
                    <div className="flex-shrink-0 text-sm font-medium text-red-600">{variant.stock} tersisa</div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info toko (tidak terpengaruh filter) */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Package, label: 'Varian Produk', value: info.totalVariants },
          { icon: Users, label: 'Member', value: info.totalCustomers },
          { icon: AlertTriangle, label: 'Stok Menipis', value: info.lowStockItems },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-base font-bold leading-none">{value}</p>
              <p className="mt-1 truncate text-[10px] text-muted-foreground md:text-xs">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
