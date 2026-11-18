import { headers } from 'next/headers';
import { db } from './db';
import { auth } from '@/auth';
import { cache } from 'react';
import { LIMIT_KEYS, UNLIMITED, type EffectiveLimits, type RawLimits } from './limit-constants';

export { LIMIT_KEYS, UNLIMITED };
export type { LimitKey, RawLimits, EffectiveLimits } from './limit-constants';

export type StorePlan = 'FREE' | 'PRO';

export interface StoreContext {
  storeId:   string;
  storeSlug: string;
  storePlan: StorePlan;
}

const resolveStore = cache(async (slug: string): Promise<StoreContext> => {
  const store = await db.store.findUnique({
    where:  { slug },
    select: { id: true, slug: true, plan: true, planExpiresAt: true },
  });

  if (!store) {
    throw new Error(`[getStoreContext] Store dengan slug "${slug}" tidak ditemukan.`);
  }

  let effectivePlan = store.plan as StorePlan;

  if (
    store.plan === 'PRO' &&
    store.planExpiresAt !== null &&
    store.planExpiresAt < new Date()
  ) {
    effectivePlan = 'FREE';
    try {
      await db.store.update({
        where: { id: store.id },
        data:  { plan: 'FREE', planExpiresAt: null, updatedAt: new Date() },
      });
    } catch (err) {
      console.error('[getStoreContext] Gagal auto-downgrade store:', err);
    }
  }

  return { storeId: store.id, storeSlug: store.slug, storePlan: effectivePlan };
});

export async function getStoreContext(): Promise<StoreContext> {
  const headersList = await headers();
  const slug = headersList.get('x-store-slug');
  if (!slug) {
    throw new Error('[getStoreContext] x-store-slug tidak ditemukan di headers.');
  }
  return resolveStore(slug);
}

export async function requireStoreAccess(): Promise<{
  storeId:    string;
  storeSlug:  string;
  storePlan:  StorePlan;
  userId:     string;
  storeRole:  string;  // StaffRoleValue dari StoreStaff
  isMember:   boolean; // apakah juga punya StoreUser (member)
}> {
  const [{ storeId, storeSlug, storePlan }, session] = await Promise.all([
    getStoreContext(),
    auth(),
  ]);

  if (!session?.user?.id) {
    throw new Error('[requireStoreAccess] User tidak terautentikasi.');
  }

  // Cek di StoreStaff (tim operasional)
  const staffRecord = await db.storeStaff.findUnique({
    where:  { storeId_userId: { storeId, userId: session.user.id } },
    select: { role: true },
  });

  // Cek di StoreUser (member) — opsional
  const memberRecord = await db.storeUser.findUnique({
    where:  { storeId_userId: { storeId, userId: session.user.id } },
    select: { id: true },
  });

  if (!staffRecord) {
    throw new Error(
      `[requireStoreAccess] User ${session.user.id} tidak memiliki akses staff ke store ${storeId}.`
    );
  }

  return {
    storeId,
    storeSlug,
    storePlan,
    userId:    session.user.id,
    storeRole: staffRecord.role,
    isMember:  !!memberRecord,
  };
}

// ─── Batas paket yang bisa diatur superadmin ─────────────────────────────────
// Prioritas: override toko → konfigurasi global paket (DB) → PLAN_LIMITS (kode)
// Nilai di DB: null = ikut level berikutnya, -1 = tak terbatas, >= 1 = batas.

function applyRaw(base: EffectiveLimits, raw?: Partial<RawLimits> | null): EffectiveLimits {
  const out = { ...base };
  if (!raw) return out;
  for (const key of LIMIT_KEYS) {
    const v = raw[key];
    if (v === null || v === undefined) continue;
    out[key] = v === UNLIMITED ? Infinity : v;
  }
  return out;
}

export function codeDefaultLimits(plan: StorePlan): EffectiveLimits {
  const l = PLAN_LIMITS[plan];
  return {
    products:           l.products,
    variantsPerProduct: l.variantsPerProduct,
    managers:           l.managers,
    cashiers:           l.cashiers,
  };
}

/** Pure: gabungkan default kode + konfigurasi global + override toko. */
export function resolveLimits(
  plan: StorePlan,
  planConfig?: Partial<RawLimits> | null,
  storeOverride?: Partial<RawLimits> | null
): EffectiveLimits {
  return applyRaw(applyRaw(codeDefaultLimits(plan), planConfig), storeOverride);
}

/** Batas level paket saja (tanpa override toko). */
export async function getPlanLevelLimits(plan: StorePlan): Promise<EffectiveLimits> {
  try {
    const cfg = await db.planLimitConfig.findUnique({ where: { plan } });
    return resolveLimits(plan, cfg);
  } catch (error) {
    console.error('[plan-limits] gagal membaca konfigurasi paket, pakai default kode:', error);
    return codeDefaultLimits(plan);
  }
}

/** Batas efektif untuk satu toko: override toko → konfigurasi paket → default kode. */
export async function getEffectiveLimits(storeId: string, plan: StorePlan): Promise<EffectiveLimits> {
  try {
    const [cfg, override] = await Promise.all([
      db.planLimitConfig.findUnique({ where: { plan } }),
      db.storeLimitOverride.findUnique({ where: { storeId } }),
    ]);
    return resolveLimits(plan, cfg, override);
  } catch (error) {
    console.error('[plan-limits] gagal membaca batas efektif, pakai default kode:', error);
    return codeDefaultLimits(plan);
  }
}

export async function checkPlanLimit(
  resource: 'products' | 'variantsPerProduct' | 'managers' | 'cashiers' | 'dailyTransactions',
  extra?: string
): Promise<{ allowed: boolean; current: number; limit: number; plan: StorePlan }> {
  const { storeId, storePlan } = await getStoreContext();

  let limit: number;
  if (resource === 'dailyTransactions') {
    limit = PLAN_LIMITS[storePlan].dailyTransactions;
  } else {
    limit = (await getEffectiveLimits(storeId, storePlan))[resource];
  }

  // Tak terbatas → tidak perlu menghitung pemakaian
  if (limit === Infinity) return { allowed: true, current: 0, limit: Infinity, plan: storePlan };

  let current = 0;
  switch (resource) {
    case 'products':
      current = await db.product.count({ where: { storeId } });
      break;
    case 'variantsPerProduct':
      current = extra ? await db.productVariant.count({ where: { storeId, productId: extra } }) : 0;
      break;
    case 'managers':
      current = await db.storeStaff.count({ where: { storeId, role: 'MANAGER' } });
      break;
    case 'cashiers':
      current = await db.storeStaff.count({ where: { storeId, role: 'CASHIER' } });
      break;
    case 'dailyTransactions': {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      current = await db.sale.count({ where: { storeId, createdAt: { gte: startOfDay } } });
      break;
    }
  }

  return { allowed: current < limit, current, limit, plan: storePlan };
}

export const MAX_STORES_PER_USER = 3;

export const PLAN_LIMITS = {
  FREE: {
    products:            15,
    variantsPerProduct:   3,
    managers:             1,
    cashiers:             1,
    dailyTransactions:  100,
    stockHistory:       false,
    exportReports:      false,
    customBranding:     false,
  },
  PRO: {
    products:           1000,
    variantsPerProduct:   Infinity,
    managers:              5,
    cashiers:              5,
    dailyTransactions:  Infinity,
    stockHistory:       true,
    exportReports:      true,
    customBranding:     true,
  },
} as const;
