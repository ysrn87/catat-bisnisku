import { headers } from 'next/headers';
import { db } from './db';
import { auth } from '@/auth';
import { cache } from 'react';

export type StorePlan = 'FREE' | 'PRO';

export interface StoreContext {
  storeId: string;
  storeSlug: string;
  storePlan: StorePlan;
}

/**
 * Resolve store dari slug, dengan lazy expiry check.
 * Kalau plan PRO sudah expired → otomatis downgrade ke FREE di DB.
 * Di-cache per request dengan React cache() agar tidak query DB berkali-kali.
 */
const resolveStore = cache(async (slug: string): Promise<StoreContext> => {
  const store = await db.store.findUnique({
    where: { slug },
    select: { id: true, slug: true, plan: true, subscriptionExpiresAt: true },
  });

  if (!store) {
    throw new Error(`[getStoreContext] Store dengan slug "${slug}" tidak ditemukan.`);
  }

  // ── Lazy expiry check ───────────────────────────────────────────────────────
  // Kalau plan PRO tapi subscriptionExpiresAt sudah lewat → downgrade ke FREE
  let effectivePlan = store.plan as StorePlan;

  if (
    store.plan === 'PRO' &&
    store.subscriptionExpiresAt !== null &&
    store.subscriptionExpiresAt < new Date()
  ) {
    effectivePlan = 'FREE';

    // Simpan downgrade ke DB (fire and forget — tidak perlu await)
    db.store.update({
      where: { id: store.id },
      data: {
        plan: 'FREE',
        subscriptionExpiresAt: null,
        updatedAt: new Date(),
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

/**
 * Ambil store context dari header yang diinjeksi middleware.
 * Gunakan di Server Components dan Server Actions.
 */
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

/**
 * Verifikasi bahwa user yang sedang login adalah member dari store ini.
 * Gunakan di Server Actions yang mengubah data (create, update, delete).
 */
export async function requireStoreAccess(): Promise<{
  storeId: string;
  storeSlug: string;
  storePlan: StorePlan;
  userId: string;
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
    where: {
      storeId_userId: {
        storeId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });

  if (!storeUser) {
    throw new Error(
      `[requireStoreAccess] User ${session.user.id} tidak memiliki akses ke store ${storeId}.`
    );
  }

  return {
    storeId,
    storeSlug,
    storePlan,
    userId: session.user.id,
    storeRole: storeUser.role,
  };
}

/**
 * Cek apakah store masih dalam batas plan FREE.
 * Gunakan sebelum create resource baru.
 */
export async function checkPlanLimit(
  resource: 'products' | 'managers',
  limit: number
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const { storeId, storePlan } = await getStoreContext();

  if (storePlan === 'PRO') {
    return { allowed: true, current: 0, limit: Infinity };
  }

  let current = 0;
  switch (resource) {
    case 'products':
      current = await db.product.count({ where: { storeId } });
      break;
    case 'managers':
      current = await db.storeUser.count({ where: { storeId, role: 'MANAGER' } });
      break;
  }

  return { allowed: current < limit, current, limit };
}

// ─── Plan limits ──────────────────────────────────────────────────────────────
export const PLAN_LIMITS = {
  FREE: {
    products: 50,
    managers: 2,
    exportReports: false,
    customBranding: false,
  },
  PRO: {
    products: Infinity,
    managers: Infinity,
    exportReports: true,
    customBranding: true,
  },
} as const;
