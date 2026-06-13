// System Settings Configuration
// This file stores adjustable system-wide settings

export interface SystemSettings {
  pointsConversionRate: number; // How much discount per point (in Rupiah)
  pointsExpiryEnabled: boolean;
  pointsExpiryMonths: number;
  minPointsForRedemption: number;
  maxPointsPerTransaction: number;
}

// Default settings
export const DEFAULT_SETTINGS: SystemSettings = {
  pointsConversionRate: 1000, // 1 point = Rp 1,000
  pointsExpiryEnabled: true,
  pointsExpiryMonths: 12, // Points expire after 12 months
  minPointsForRedemption: 10, // Minimum 10 points to redeem
  maxPointsPerTransaction: 1000, // Max 1000 points per transaction
};

// Helper function to format conversion rate
export function formatConversionRate(rate: number): string {
  return `1 point = Rp ${rate.toLocaleString('id-ID')}`;
}