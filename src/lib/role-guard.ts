/**
 * role-guard.ts (final)
 * ============================================================
 * syncGlobalRole() DIHAPUS — User tidak punya field role lagi.
 * Otorisasi 100% dari StoreUser.role.
 * isSuperAdmin di-set manual di DB, tidak perlu di-sync.
 * ============================================================
 */

import { db } from '@/lib/db';

export type StoreRoleValue =
  | 'OWNER'
  | 'ADMINISTRATOR'
  | 'MANAGER'
  | 'CASHIER'
  | 'MEMBER'
  | 'CUSTOMER';

export const ROLE_HIERARCHY: Record<StoreRoleValue, number> = {
  OWNER:         0,
  ADMINISTRATOR: 1,
  MANAGER:       2,
  CASHIER:       3,
  MEMBER:        4,
  CUSTOMER:      5,
};

const PRIVILEGED_ROLES: StoreRoleValue[] = ['OWNER', 'ADMINISTRATOR'];

export interface RoleConflictResult {
  hasConflict: boolean;
  isWarning?:  boolean;
  reason?:     string;
  existingRoles?: { storeName: string; role: StoreRoleValue }[];
}

export async function checkRoleConflict(
  userId: string,
  targetStoreId: string,
  targetRole: StoreRoleValue
): Promise<RoleConflictResult> {
  const existingMemberships = await db.storeUser.findMany({
    where:   { userId },
    include: { store: { select: { id: true, name: true } } },
  });

  const sameStore = existingMemberships.find((m) => m.storeId === targetStoreId);
  if (sameStore) {
    return {
      hasConflict: true,
      reason: `User sudah terdaftar di toko ini sebagai ${sameStore.role}. Gunakan fitur ubah role.`,
      existingRoles: existingMemberships.map((m) => ({
        storeName: m.store.name,
        role: m.role as StoreRoleValue,
      })),
    };
  }

  const privilegedElsewhere = existingMemberships.filter((m) =>
    PRIVILEGED_ROLES.includes(m.role as StoreRoleValue)
  );
  if (privilegedElsewhere.length > 0 && !PRIVILEGED_ROLES.includes(targetRole)) {
    return {
      hasConflict: false,
      isWarning:   true,
      reason: `User ini adalah ${privilegedElsewhere[0].role} di toko "${privilegedElsewhere[0].store.name}". Tetap tambahkan sebagai ${targetRole}?`,
      existingRoles: existingMemberships.map((m) => ({
        storeName: m.store.name,
        role: m.role as StoreRoleValue,
      })),
    };
  }

  return { hasConflict: false };
}

export function canAssignRole(
  actorRole: StoreRoleValue,
  targetRole: StoreRoleValue
): boolean {
  return ROLE_HIERARCHY[actorRole] < ROLE_HIERARCHY[targetRole];
}
