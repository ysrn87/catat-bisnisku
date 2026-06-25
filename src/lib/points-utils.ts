import { db } from '@/lib/db';

// ─────────────────────────────────────────────────────────────
// getAvailablePoints
// Baca dari StoreUser.points langsung (sumber kebenaran saldo).
// Lebih efisien dari kalkulasi ulang PointHistory.
// ─────────────────────────────────────────────────────────────
export async function getAvailablePoints(userId: string, storeId: string): Promise<number> {
  const storeUser = await db.storeUser.findUnique({
    where:  { storeId_userId: { storeId, userId } },
    select: { points: true },
  });
  return storeUser?.points ?? 0;
}

// ─────────────────────────────────────────────────────────────
// expireOldPoints
// Tidak dipakai di skema baru — expiresAt dihapus dari PointHistory.
// Kalau fitur expiry dibutuhkan di masa depan, implementasi
// di level StoreUser (tambah field pointsExpiresAt).
// Fungsi ini dipertahankan sebagai stub agar tidak breaking import.
// ─────────────────────────────────────────────────────────────
export async function expireOldPoints() {
  // TODO: implementasi kalau fitur expiry diaktifkan kembali
  return [];
}

// ─────────────────────────────────────────────────────────────
// Konversi poin ↔ Rupiah
// ─────────────────────────────────────────────────────────────
export function pointsToDiscount(points: number, conversionRate: number = 1000): number {
  return points * conversionRate;
}

export function discountToPoints(discount: number, conversionRate: number = 1000): number {
  return Math.floor(discount / conversionRate);
}
