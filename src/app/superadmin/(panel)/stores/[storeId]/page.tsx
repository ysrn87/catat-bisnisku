import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { updateStoreLimitsAction } from '@/actions/superadmin';
import { LimitsForm } from '@/components/superadmin/limits-form';
import { LIMIT_KEYS, UNLIMITED, formatLimit, type LimitKey, type RawLimits } from '@/lib/limit-constants';
import { getEffectiveLimits, getPlanLevelLimits, type StorePlan } from '@/lib/store-context';

export default async function SuperAdminStoreDetailPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;

  const store = await db.store.findUnique({
    where:   { id: storeId },
    include: { owner: { select: { name: true, email: true } }, limitOverride: true },
  });
  if (!store) notFound();

  const plan = store.plan as StorePlan;

  const [planLevel, effective, products, managers, cashiers, topVariant] = await Promise.all([
    getPlanLevelLimits(plan),
    getEffectiveLimits(store.id, plan),
    db.product.count({ where: { storeId } }),
    db.storeStaff.count({ where: { storeId, role: 'MANAGER' } }),
    db.storeStaff.count({ where: { storeId, role: 'CASHIER' } }),
    db.productVariant.groupBy({
      by:      ['productId'],
      where:   { storeId },
      _count:  { _all: true },
      orderBy: { _count: { productId: 'desc' } },
      take:    1,
    }),
  ]);

  const usage: Record<LimitKey, number> = {
    products,
    managers,
    cashiers,
    variantsPerProduct: topVariant[0]?._count._all ?? 0,
  };

  const current: RawLimits = {
    products:           store.limitOverride?.products           ?? null,
    variantsPerProduct: store.limitOverride?.variantsPerProduct ?? null,
    managers:           store.limitOverride?.managers           ?? null,
    cashiers:           store.limitOverride?.cashiers           ?? null,
  };

  const inherited = Object.fromEntries(
    LIMIT_KEYS.map((k) => [k, planLevel[k] === Infinity ? UNLIMITED : planLevel[k]])
  ) as Record<LimitKey, number>;

  const labels: Record<LimitKey, string> = {
    products: 'Produk', variantsPerProduct: 'Varian terbanyak pada satu produk', managers: 'Manager', cashiers: 'Kasir',
  };

  return (
    <div className="space-y-6">
      <Link href="/superadmin" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Kembali ke daftar toko
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">{store.name}</h1>
        <p className="text-sm text-gray-500">
          /{store.slug} · Paket {plan} · Owner: {store.owner.name} ({store.owner.email})
        </p>
      </div>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-medium text-slate-900">Pemakaian saat ini</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {LIMIT_KEYS.map((k) => (
            <div key={k} className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">{labels[k]}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {usage[k].toLocaleString('id-ID')} <span className="text-sm font-normal text-gray-500">/ {formatLimit(effective[k])}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-medium text-slate-900">Batas khusus toko ini</h2>
        <p className="mb-2 mt-1 text-sm text-gray-500">
          Pilih "Ikut default paket" untuk mengikuti pengaturan global paket {plan}. Perubahan berlaku langsung.
        </p>
        <LimitsForm
          action={updateStoreLimitsAction}
          hidden={{ storeId: store.id }}
          current={current}
          inherited={inherited}
          inheritedLabel="Default paket"
        />
      </section>
    </div>
  );
}
