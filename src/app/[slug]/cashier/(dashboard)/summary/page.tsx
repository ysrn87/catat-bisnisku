import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { SummaryView } from '@/components/dashboard/summary-view';
import { getRangeWindow, parseDashboardQuery } from '@/lib/dashboard-range';
import { getPeriodSales, getTopProducts, getRecentSales } from '@/lib/dashboard-summary';

export default async function CashierSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string; date?: string; from?: string; to?: string }>;
}) {
  const [{ slug }, sp, { storeId }, session] = await Promise.all([
    params, searchParams, getStoreContext(), auth(),
  ]);
  if (!session?.user?.id) redirect(`/login?callbackUrl=/${slug}/cashier/summary`);

  // Identitas kasir SELALU diambil dari session — tidak pernah dari URL/parameter —
  // supaya kasir tidak bisa melihat ringkasan kasir lain.
  const staff = await db.storeStaff.findUnique({
    where: { storeId_userId: { storeId, userId: session.user.id } },
    select: { id: true },
  });
  if (!staff) redirect('/unauthorized');

  const win = getRangeWindow(parseDashboardQuery(sp ?? {}));

  const [period, topProducts, recentSales] = await Promise.all([
    getPeriodSales(storeId, win, staff.id),
    getTopProducts(storeId, win, staff.id),
    getRecentSales(storeId, win, staff.id),
  ]);

  return (
    <SummaryView
      scope="cashier"
      basePath={`/${slug}/cashier/summary`}
      win={win}
      period={period}
      topProducts={topProducts}
      recentSales={recentSales}
    />
  );
}
