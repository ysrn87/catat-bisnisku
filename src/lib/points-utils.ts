// Utility functions for points management
import { db } from '@/lib/db';

/**
 * Get the expiry date for points earned today.
 * Points expire on December 31 of the current year.
 */
export function getPointsExpiryDate(earnedDate: Date = new Date()): Date {
  const year = earnedDate.getFullYear();
  return new Date(year, 11, 31, 23, 59, 59);
}

/**
 * Calculate available (non-expired) points for a user at a specific store.
 * Reads directly from PointHistory so expiry is always accurate.
 */
export async function getAvailablePoints(userId: string, storeId?: string): Promise<number> {
  const now = new Date();

  const history = await db.pointHistory.findMany({
    where: {
      userId,
      ...(storeId ? { storeId } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });

  let available = 0;
  for (const entry of history) {
    if (entry.expiresAt && entry.expiresAt < now) continue;
    available += entry.points; // REDEEMED/EXPIRED entries are already negative
  }

  return Math.max(0, available);
}

/**
 * Expire old points for all stores.
 * Finds PointHistory EARNED entries that have passed their expiresAt date,
 * then decrements StoreUser.points and records an EXPIRED entry.
 *
 * Run this on Jan 1 or periodically via a cron job.
 */
export async function expireOldPoints() {
  const now = new Date();

  // Find all un-expired EARNED entries that are now past their expiry date
  const expiredEntries = await db.pointHistory.findMany({
    where: {
      type: 'EARNED',
      expiresAt: { lt: now },
      storeId: { not: null },
    },
    select: {
      userId: true,
      storeId: true,
      points: true,
    },
  });

  // Group by (userId, storeId) and sum expired points
  const grouped = new Map<string, { userId: string; storeId: string; total: number }>();
  for (const entry of expiredEntries) {
    if (!entry.storeId) continue;
    const key = `${entry.userId}::${entry.storeId}`;
    if (!grouped.has(key)) {
      grouped.set(key, { userId: entry.userId, storeId: entry.storeId, total: 0 });
    }
    grouped.get(key)!.total += entry.points;
  }

  const results = [];

  for (const { userId, storeId, total } of grouped.values()) {
    if (total <= 0) continue;

    // Deduct from StoreUser.points (floor at 0 — can't go negative)
    await db.storeUser.updateMany({
      where: { userId, storeId, points: { gt: 0 } },
      data: { points: { decrement: total } },
    });

    // Record the expiry
    await db.pointHistory.create({
      data: {
        userId,
        storeId,
        points: -total,
        type: 'EXPIRED',
        description: `Poin expired pada ${now.toLocaleDateString('id-ID')}`,
        createdAt: now,
      },
    });

    const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
    results.push({ userId, storeId, expiredPoints: total, userName: user?.name ?? userId });
  }

  return results;
}

/**
 * Convert points to discount value (Rupiah).
 * Example: 1 point = Rp 1,000 discount
 */
export function pointsToDiscount(points: number, conversionRate: number = 1000): number {
  return points * conversionRate;
}

/**
 * Convert discount value to points needed.
 */
export function discountToPoints(discount: number, conversionRate: number = 1000): number {
  return Math.floor(discount / conversionRate);
}
