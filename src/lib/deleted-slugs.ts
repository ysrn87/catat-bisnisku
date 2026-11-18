import { db } from './db';

/** Lama slug toko yang dihapus ditahan sebelum boleh dipakai lagi. */
export const SLUG_HOLD_DAYS = 30;

export async function isSlugOnHold(slug: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - SLUG_HOLD_DAYS * 24 * 60 * 60 * 1000);
  const row = await db.deletedStoreSlug.findFirst({
    where:  { slug, deletedAt: { gt: cutoff } },
    select: { slug: true },
  });
  return !!row;
}
