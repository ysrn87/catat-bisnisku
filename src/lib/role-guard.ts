/**
 * role-guard.ts
 * ============================================================
 * Setelah refactor StoreStaff:
 * - StaffRole: OWNER | ADMINISTRATOR | MANAGER | CASHIER
 * - StoreUser sekarang murni member — tidak ada di sini
 * - checkRoleConflict & canAssignRole hanya berlaku untuk StoreStaff
 * ============================================================
 */

import { db } from '@/lib/db';

export type StaffRoleValue =
  | 'OWNER'
  | 'ADMINISTRATOR'
  | 'MANAGER'
  | 'CASHIER';

export const STAFF_ROLE_HIERARCHY: Record<StaffRoleValue, number> = {
  OWNER:         0,
  ADMINISTRATOR: 1,
  MANAGER:       2,
  CASHIER:       3,
};

const PRIVILEGED_ROLES: StaffRoleValue[] = ['OWNER', 'ADMINISTRATOR'];

export interface RoleConflictResult {
  hasConflict: boolean;
  isWarning?:  boolean;
  reason?:     string;
  existingRoles?: { storeName: string; role: StaffRoleValue }[];
}

export async function checkStaffConflict(
  userId: string,
  targetStoreId: string,
  targetRole: StaffRoleValue
): Promise<RoleConflictResult> {
  const existingStaff = await db.storeStaff.findMany({
    where:   { userId },
    include: { store: { select: { id: true, name: true } } },
  });

  const sameStore = existingStaff.find((s) => s.storeId === targetStoreId);
  if (sameStore) {
    return {
      hasConflict: true,
      reason: `User sudah terdaftar di toko ini sebagai ${sameStore.role}. Gunakan fitur ubah role.`,
      existingRoles: existingStaff.map((s) => ({
        storeName: s.store.name,
        role: s.role as StaffRoleValue,
      })),
    };
  }

  const privilegedElsewhere = existingStaff.filter((s) =>
    PRIVILEGED_ROLES.includes(s.role as StaffRoleValue)
  );
  if (privilegedElsewhere.length > 0 && !PRIVILEGED_ROLES.includes(targetRole)) {
    return {
      hasConflict: false,
      isWarning:   true,
      reason: `User ini adalah ${privilegedElsewhere[0].role} di toko "${privilegedElsewhere[0].store.name}". Tetap tambahkan sebagai ${targetRole}?`,
      existingRoles: existingStaff.map((s) => ({
        storeName: s.store.name,
        role: s.role as StaffRoleValue,
      })),
    };
  }

  return { hasConflict: false };
}

export function canAssignStaffRole(
  actorRole: StaffRoleValue,
  targetRole: StaffRoleValue
): boolean {
  return STAFF_ROLE_HIERARCHY[actorRole] < STAFF_ROLE_HIERARCHY[targetRole];
}

// ─── Backward-compat alias (hapus bertahap saat semua caller sudah diupdate) ──
/** @deprecated gunakan checkStaffConflict */
export const checkRoleConflict = checkStaffConflict;
/** @deprecated gunakan canAssignStaffRole */
export const canAssignRole = canAssignStaffRole;
/** @deprecated gunakan StaffRoleValue */
export type StoreRoleValue = StaffRoleValue;
