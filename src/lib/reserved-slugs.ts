// Slug toko yang tidak boleh dipakai karena bentrok dengan route aplikasi.
export const RESERVED_SLUGS = new Set([
  'superadmin', 'admin', 'api', 'login', 'logout', 'register', 'register-store',
  'store-select', 'member-select', 'join-store', 'forgot-password', 'reset-password',
  'invitation', 'catalog', 'unauthorized', 'offline', 'upgrade', 'manager', 'cashier',
  'member', 'settings', 'static', 'public', 'www',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
