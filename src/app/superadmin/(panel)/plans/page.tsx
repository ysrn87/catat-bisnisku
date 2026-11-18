import { db } from '@/lib/db';
import { updatePlanLimitsAction } from '@/actions/superadmin';
import { LimitsForm } from '@/components/superadmin/limits-form';
import { LIMIT_KEYS, UNLIMITED, type LimitKey, type RawLimits } from '@/lib/limit-constants';
import { codeDefaultLimits, type StorePlan } from '@/lib/store-context';

const PLANS: StorePlan[] = ['FREE', 'PRO'];

export default async function SuperAdminPlansPage() {
  const [configs, storeCounts] = await Promise.all([
    db.planLimitConfig.findMany(),
    db.store.groupBy({ by: ['plan'], _count: { _all: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Batas per paket (global)</h1>
        <p className="mt-1 text-sm text-gray-500">
          Berlaku untuk semua toko pada paket tersebut, kecuali toko yang punya batas khusus.
          Urutan: batas khusus toko, lalu pengaturan di sini, lalu bawaan kode.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {PLANS.map((plan) => {
          const cfg  = configs.find((c) => c.plan === plan);
          const code = codeDefaultLimits(plan);

          const current: RawLimits = {
            products:           cfg?.products           ?? null,
            variantsPerProduct: cfg?.variantsPerProduct ?? null,
            managers:           cfg?.managers           ?? null,
            cashiers:           cfg?.cashiers           ?? null,
          };
          const inherited = Object.fromEntries(
            LIMIT_KEYS.map((k) => [k, code[k] === Infinity ? UNLIMITED : code[k]])
          ) as Record<LimitKey, number>;
          const count = storeCounts.find((c) => c.plan === plan)?._count._all ?? 0;

          return (
            <section key={plan} className="rounded-xl border bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-slate-900">Paket {plan}</h2>
                <span className="text-xs text-gray-500">{count.toLocaleString('id-ID')} toko</span>
              </div>
              <LimitsForm
                action={updatePlanLimitsAction}
                hidden={{ plan }}
                current={current}
                inherited={inherited}
                inheritedLabel="Bawaan kode"
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
