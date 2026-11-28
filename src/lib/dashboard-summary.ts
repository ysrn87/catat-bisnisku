// Query data Ringkasan — dipakai bersama oleh halaman Admin, Manager, dan Kasir.
//
// `cashierId` (StoreStaff.id) opsional:
//  - tidak diisi  → data seluruh toko (Admin & Manager)
//  - diisi        → hanya penjualan milik kasir itu (halaman Kasir)
// Filter dipasang di sini (server) sehingga UI tidak bisa melewatinya.

import { db } from '@/lib/db';
import { lowStockWhere } from '@/lib/inventory-totals';
import { paymentMethodLabel } from '@/lib/payment';
import type { SalesTrendPoint } from '@/components/charts/sales-trend-chart';
import type { RangeWindow } from '@/lib/dashboard-range';

export type PayStatus = 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED';

// Penjualan lama (sebelum ada tabel Payment) tidak punya baris payment → dianggap lunas.
export function statusOf(payment: { status: PayStatus } | null): PayStatus {
  return payment?.status ?? 'PAID';
}

const scopeOf = (storeId: string, cashierId?: string) =>
  cashierId ? { storeId, cashierId } : { storeId };

export async function getPeriodSales(storeId: string, win: RangeWindow, cashierId?: string) {
  const scope = scopeOf(storeId, cashierId);
  const [sales, prevSales] = await Promise.all([
    db.sale.findMany({
      where: { ...scope, createdAt: { gte: win.start, lt: win.end } },
      select: {
        total: true,
        createdAt: true,
        payment: { select: { status: true, method: true } },
        items: { select: { quantity: true } },
      },
    }),
    db.sale.findMany({
      where: { ...scope, createdAt: { gte: win.prevStart, lt: win.prevEnd } },
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
export type PeriodSummary = Awaited<ReturnType<typeof getPeriodSales>>;

export async function getTopProducts(storeId: string, win: RangeWindow, cashierId?: string) {
  const grouped = await db.saleItem.groupBy({
    by: ['variantId'],
    where: {
      sale: {
        ...scopeOf(storeId, cashierId),
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
export type TopProduct = Awaited<ReturnType<typeof getTopProducts>>[number];

/** Penjualan terbaru DI DALAM periode yang dipilih. */
export async function getRecentSales(storeId: string, win: RangeWindow, cashierId?: string) {
  return db.sale.findMany({
    where: { ...scopeOf(storeId, cashierId), createdAt: { gte: win.start, lt: win.end } },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { name: true } }, payment: { select: { status: true } } },
  });
}
export type RecentSale = Awaited<ReturnType<typeof getRecentSales>>[number];

/** Info toko (tidak terpengaruh filter periode). Hanya untuk Admin & Manager. */
export async function getStoreInfo(storeId: string) {
  const [totalVariants, totalCustomers, lowStockItems, lowStockProducts] = await Promise.all([
    db.productVariant.count({ where: { storeId } }),
    db.storeUser.count({ where: { storeId } }),
    db.productVariant.count({ where: lowStockWhere(storeId) }),
    db.productVariant.findMany({ where: lowStockWhere(storeId), include: { product: true }, take: 5 }),
  ]);
  return { totalVariants, totalCustomers, lowStockItems, lowStockProducts };
}
export type StoreInfo = Awaited<ReturnType<typeof getStoreInfo>>;
