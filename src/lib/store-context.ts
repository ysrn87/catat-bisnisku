import { headers } from 'next/headers';
import { db } from './db';
import { auth } from '@/auth';
import { cache } from 'react';

export type StorePlan = 'FREE' | 'PRO';

export interface StoreContext {
  storeId:   string;
  storeSlug: string;
  storePlan: StorePlan;
}

/**
 * Resolve store dari slug, dengan lazy expiry check.
 * Kalau plan PRO sudah expired → otomatis downgrade ke FREE di DB.
 */
const resolveStore = cache(async (slug: string): Promise<StoreContext> => {
  const store = await db.store.findUnique({
    where:  { slug },
    // FIX: subscriptionExpiresAt → planExpiresAt (sesuai skema baru)
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

    db.store.update({
      where: { id: store.id },
      data: {
        plan:         'FREE',
        planExpiresAt: null, // FIX: subscriptionExpiresAt → planExpiresAt
        updatedAt:    new Date(),
      },
    }).catch((err) => {
      console.error('[getStoreContext] Gagal auto-downgrade store:', err);
    });
  }

  return {
    storeId:   store.id,
    storeSlug: store.slug,
    storePlan: effectivePlan,
  };
});

export async function getStoreContext(): Promise<StoreContext> {
  const headersList = await headers();
  const slug = headersList.get('x-store-slug');

  if (!slug) {
    throw new Error(
      '[getStoreContext] x-store-slug tidak ditemukan di headers. ' +
      'Pastikan request melewati middleware dan path menggunakan format /[slug]/...'
    );
  }

  return resolveStore(slug);
}

export async function requireStoreAccess(): Promise<{
  storeId:   string;
  storeSlug: string;
  storePlan: StorePlan;
  userId:    string;
  storeRole: string;
}> {
  const [{ storeId, storeSlug, storePlan }, session] = await Promise.all([
    getStoreContext(),
    auth(),
  ]);

  if (!session?.user?.id) {
    throw new Error('[requireStoreAccess] User tidak terautentikasi.');
  }

  const storeUser = await db.storeUser.findUnique({
    where: { storeId_userId: { storeId, userId: session.user.id } },
    select: { role: true },
  });

  if (!storeUser) {
    throw new Error(
      `[requireStoreAccess] User ${session.user.id} tidak memiliki akses ke store ${storeId}.`
    );
  }

  return { storeId, storeSlug, storePlan, userId: session.user.id, storeRole: storeUser.role };
}

export async function checkPlanLimit(
  resource: 'products' | 'variantsPerProduct' | 'managers' | 'cashiers' | 'dailyTransactions',
  extra?: string
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const { storeId, storePlan } = await getStoreContext();
  const limits = PLAN_LIMITS[storePlan];

  let current = 0;
  let limit   = 0;

  switch (resource) {
    case 'products':
      limit   = limits.products;
      current = await db.product.count({ where: { storeId } });
      break;
    case 'variantsPerProduct':
      limit   = limits.variantsPerProduct;
      current = extra ? await db.productVariant.count({ where: { storeId, productId: extra } }) : 0;
      break;
    case 'managers':
      limit   = limits.managers;
      current = await db.storeUser.count({ where: { storeId, role: 'MANAGER' } });
      break;
    case 'cashiers':
      limit   = limits.cashiers;
      current = await db.storeUser.count({ where: { storeId, role: 'CASHIER' } });
      break;
    case 'dailyTransactions': {
      limit = limits.dailyTransactions;
      if (limit === Infinity) return { allowed: true, current: 0, limit: Infinity };
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      current = await db.sale.count({ where: { storeId, createdAt: { gte: startOfDay } } });
      break;
    }
  }

  return { allowed: current < limit, current, limit };
}

export const MAX_STORES_PER_USER = 3;

export const PLAN_LIMITS = {
  FREE: {
    products:           15,
    variantsPerProduct:  3,
    managers:            1,
    cashiers:            1,
    dailyTransactions:  100,
    stockHistory:       false,
    exportReports:      false,
    customBranding:     false,
  },
  PRO: {
    products:           1000,
    variantsPerProduct:  10,
    managers:             5,
    cashiers:             5,
    dailyTransactions:  Infinity,
    stockHistory:       true,
    exportReports:      true,
    customBranding:     true,
  },
} as const;
