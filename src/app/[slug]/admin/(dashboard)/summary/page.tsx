import { getStoreContext } from '@/lib/store-context';
import { SummaryView } from '@/components/dashboard/summary-view';
import { getRangeWindow, parseDashboardQuery } from '@/lib/dashboard-range';
import { getPeriodSales, getTopProducts, getRecentSales, getStoreInfo } from '@/lib/dashboard-summary';

export default async function RingkasanPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string; date?: string; from?: string; to?: string }>;
}) {
  const [{ slug }, sp, { storeId }] = await Promise.all([params, searchParams, getStoreContext()]);
  const win = getRangeWindow(parseDashboardQuery(sp ?? {}));

  const [period, topProducts, recentSales, storeInfo] = await Promise.all([
    getPeriodSales(storeId, win),
    getTopProducts(storeId, win),
    getRecentSales(storeId, win),
    getStoreInfo(storeId),
  ]);

  return (
    <SummaryView
      basePath={`/${slug}/admin/summary`}
      win={win}
      period={period}
      topProducts={topProducts}
      recentSales={recentSales}
      storeInfo={storeInfo}
    />
  );
}
