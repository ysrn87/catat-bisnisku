// Utility functions for points management
import { db } from '@/lib/db';

/**
 * Calculate available (non-expired) points for a user
 * Points expire on Dec 31 of the year they were earned
 */
export async function getAvailablePoints(userId: string): Promise<number> {
  const now = new Date();

  // Get all point history for the user
  const history = await db.pointHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  let availablePoints = 0;

  for (const entry of history) {
    // Skip expired points
    if (entry.expiresAt && entry.expiresAt < now) {
      continue;
    }

    // All types: just add the points (REDEEMED are already negative)
    availablePoints += entry.points;
  }

  return Math.max(0, availablePoints);
}

/**
 * Get the expiry date for points earned today
 * Points expire on December 31 of the current year
 */
export function getPointsExpiryDate(earnedDate: Date = new Date()): Date {
  const year = earnedDate.getFullYear();
  // Dec 31, 23:59:59 of the earning year
  return new Date(year, 11, 31, 23, 59, 59);
}

/**
 * Expire old points (run this on Jan 1 or periodically)
 */
export async function expireOldPoints() {
  const now = new Date();

  // Find all users with points
  const users = await db.user.findMany({
    where: { points: { gt: 0 } },
    include: {
      pointsHistory: {
        where: {
          expiresAt: { lt: now },
          type: 'EARNED',
        },
      },
    },
  });

  const results = [];

  for (const user of users) {
    let expiredPoints = 0;

    // Calculate expired points
    for (const history of user.pointsHistory) {
      if (history.expiresAt && history.expiresAt < now) {
        expiredPoints += history.points;
      }
    }

    if (expiredPoints > 0) {
      // Deduct expired points from user
      await db.user.update({
        where: { id: user.id },
        data: { points: { decrement: expiredPoints } },
      });

      // Record expiry in history
      await db.pointHistory.create({
        data: {
          userId: user.id,
          points: -expiredPoints,
          type: 'EXPIRED',
          description: `Points expired on ${now.toLocaleDateString()}`,
          createdAt: now,
        },
      });

      results.push({
        userId: user.id,
        userName: user.name,
        expiredPoints,
      });
    }
  }

  return results;
}

/**
 * Convert points to discount value
 * Example: 1 point = Rp 1,000 discount
 */
export function pointsToDiscount(points: number, conversionRate: number = 1000): number {
  return points * conversionRate;
}

/**
 * Convert discount value to points needed
 */
export function discountToPoints(discount: number, conversionRate: number = 1000): number {
  return Math.floor(discount / conversionRate);
}
