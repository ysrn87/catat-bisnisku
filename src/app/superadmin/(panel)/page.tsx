import Link from 'next/link';
import { db } from '@/lib/db';
import { formatLimit } from '@/lib/limit-constants';
import { resolveLimits, type StorePlan } from '@/lib/store-context';

const PAGE_SIZE = 20;

export default async function SuperAdminStoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q: rawQ, page: rawPage } = await searchParams;
  const q    = (rawQ ?? '').trim().slice(0, 100);
  const page = Math.max(1, parseInt(rawPage ?? '1', 10) || 1);

  const where = q
    ? {
        OR: [
          { name:  { contains: q, mode: 'insensitive' as const } },
          { slug:  { contains: q, mode: 'insensitive' as const } },
          { owner: { email: { contains: q, mode: 'insensitive' as const } } },
        ],
      }
    : {};

  const [total, stores, planConfigs, proCount, overrideCount] = await Promise.all([
    db.store.count({ where }),
    db.store.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * PAGE_SIZE,
      take:    PAGE_SIZE,
      include: {
        owner:         { select: { name: true, email: true } },
        limitOverride: true,
        _count:        { select: { products: true } },
      },
    }),
    db.planLimitConfig.findMany(),
    db.store.count({ where: { plan: 'PRO' } }),
    db.storeLimitOverride.count(),
  ]);

  const staffCounts = await db.storeStaff.groupBy({
    by:    ['storeId', 'role'],
    where: { storeId: { in: stores.map((s) => s.id) }, role: { in: ['MANAGER', 'CASHIER'] } },
    _count: { _all: true },
  });
  const staffOf = (storeId: string, role: 'MANAGER' | 'CASHIER') =>
    staffCounts.find((c) => c.storeId === storeId && c.role === role)?._count._all ?? 0;

  const configOf = (plan: StorePlan) => planConfigs.find((c) => c.plan === plan) ?? null;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => `/superadmin?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total toko (hasil pencarian)', value: total },
          { label: 'Toko PRO',                      value: proCount },
          { label: 'Toko dengan batas khusus',      value: overrideCount },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border bg-white p-4">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{c.value.toLocaleString('id-ID')}</p>
          </div>
        ))}
      </div>

      <form className="flex gap-2" action="/superadmin" method="get">
        <input
          name="q" defaultValue={q} placeholder="Cari nama toko, slug, atau email owner"
          className="h-10 w-full max-w-md rounded-md border border-input bg-white px-3 text-sm"
        />
        <button type="submit" className="h-10 rounded-md bg-slate-900 px-4 text-sm text-white hover:bg-slate-700">Cari</button>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Toko</th>
              <th className="px-4 py-3 font-medium">Paket</th>
              <th className="px-4 py-3 font-medium">Produk</th>
              <th className="px-4 py-3 font-medium">Manager</th>
              <th className="px-4 py-3 font-medium">Kasir</th>
              <th className="px-4 py-3 font-medium">Varian/produk</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {stores.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Tidak ada toko ditemukan.</td></tr>
            )}
            {stores.map((s) => {
              const plan = s.plan as StorePlan;
              const eff  = resolveLimits(plan, configOf(plan), s.limitOverride);
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <Link href={`/superadmin/stores/${s.id}`} className="font-medium text-[#028697] hover:underline">{s.name}</Link>
                    <div className="text-xs text-gray-500">/{s.slug} · {s.owner.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${plan === 'PRO' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{plan}</span>
                    {s.limitOverride && <span className="ml-1.5 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">batas khusus</span>}
                  </td>
                  <td className="px-4 py-3">{s._count.products} / {formatLimit(eff.products)}</td>
                  <td className="px-4 py-3">{staffOf(s.id, 'MANAGER')} / {formatLimit(eff.managers)}</td>
                  <td className="px-4 py-3">{staffOf(s.id, 'CASHIER')} / {formatLimit(eff.cashiers)}</td>
                  <td className="px-4 py-3">{formatLimit(eff.variantsPerProduct)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/superadmin/stores/${s.id}`} className="text-[#028697] hover:underline">Atur</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Halaman {page} dari {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={pageHref(page - 1)} className="rounded-md border bg-white px-3 py-1.5 hover:bg-gray-50">Sebelumnya</Link>}
            {page < totalPages && <Link href={pageHref(page + 1)} className="rounded-md border bg-white px-3 py-1.5 hover:bg-gray-50">Berikutnya</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
