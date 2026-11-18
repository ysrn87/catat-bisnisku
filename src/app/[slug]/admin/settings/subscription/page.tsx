import { db } from '@/lib/db';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getStoreContext } from '@/lib/store-context';
import { PLAN_LIMITS, getEffectiveLimits, getPlanLevelLimits } from '@/lib/store-context';
import { SubscriptionClient } from '@/components/settings/subscription-client';

export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session  = await auth();
  if (!session) redirect(`/login?callbackUrl=/${slug}/admin/settings/subscription`);

  const { storeId, storePlan } = await getStoreContext();

  // Hanya OWNER yang boleh akses billing
  const staffRecord = await db.storeStaff.findFirst({
    where: { userId: session.user.id, storeId, role: 'OWNER' },
  });
  if (!staffRecord) redirect(`/${slug}/admin`);

  const store = await db.store.findUnique({
    where:  { id: storeId },
    select: { plan: true, planExpiresAt: true },
  });
  if (!store) redirect('/store-select');

  // Batas efektif: override toko → konfigurasi global paket → default kode
  const [effective, proLevel] = await Promise.all([
    getEffectiveLimits(storeId, storePlan),
    getPlanLevelLimits('PRO'),
  ]);
  type L = { products: number; managers: number; cashiers: number; dailyTransactions: number };
  const planLimits: { FREE: L; PRO: L } = {
    FREE: { products: PLAN_LIMITS.FREE.products, managers: PLAN_LIMITS.FREE.managers, cashiers: PLAN_LIMITS.FREE.cashiers, dailyTransactions: PLAN_LIMITS.FREE.dailyTransactions },
    PRO:  { products: proLevel.products, managers: proLevel.managers, cashiers: proLevel.cashiers, dailyTransactions: PLAN_LIMITS.PRO.dailyTransactions },
  };
  planLimits[storePlan] = {
    ...planLimits[storePlan],
    products: effective.products,
    managers: effective.managers,
    cashiers: effective.cashiers,
  };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [productCount, managerCount, cashierCount, todayTxCount, paymentHistory] = await Promise.all([
    db.product.count({ where: { storeId } }),
    db.storeStaff.count({ where: { storeId, role: 'MANAGER' } }),
    db.storeStaff.count({ where: { storeId, role: 'CASHIER' } }),
    db.sale.count({ where: { storeId, createdAt: { gte: startOfDay } } }),
    db.upgradePayment.findMany({
      where:   { storeId },
      orderBy: { createdAt: 'desc' },
      take:    10,
      select:  { id: true, amount: true, status: true, paidAt: true, createdAt: true, planDays: true, midtransOrderId: true },
    }),
  ]);

  return (
    <SubscriptionClient
      storeSlug={slug}
      plan={store.plan as 'FREE' | 'PRO'}
      planExpiresAt={store.planExpiresAt?.toISOString() ?? null}
      usage={{ productCount, managerCount, cashierCount, todayTxCount }}
      planLimits={planLimits}
      paymentHistory={paymentHistory.map((p) => ({
        ...p,
        amount: Number(p.amount),
        paidAt: p.paidAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  );
}
