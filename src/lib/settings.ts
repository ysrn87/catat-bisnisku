// System Settings Configuration

export interface SystemSettings {
  pointsConversionRate:    number; // 1 point = X Rupiah diskon
  minPointsForRedemption:  number; // Minimum poin untuk bisa redeem
  maxPointsPerTransaction: number; // Maksimum poin yang bisa di-earn per transaksi
  // FIX: hapus pointsExpiryEnabled dan pointsExpiryMonths
  // Expiry dihapus dari skema baru — kalau dibutuhkan, implementasi
  // di level StoreUser (tambah field pointsExpiresAt) di iterasi berikutnya
}

export const DEFAULT_SETTINGS: SystemSettings = {
  pointsConversionRate:    1000, // 1 point = Rp 1.000
  minPointsForRedemption:  10,   // Minimal 10 poin untuk redeem
  maxPointsPerTransaction: 1000, // Maksimal 1000 poin per transaksi
};

export function formatConversionRate(rate: number): string {
  return `1 poin = Rp ${rate.toLocaleString('id-ID')}`;
}
