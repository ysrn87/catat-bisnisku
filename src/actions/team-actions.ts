'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import {
  type StaffRoleValue,
  checkStaffConflict,
  canAssignStaffRole,
} from '@/lib/role-guard';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess, checkPlanLimit } from '@/lib/store-context';

type SwitchableRole = 'MANAGER' | 'CASHIER';

export interface SwitchRoleResult {
  success: boolean;
  error?:  string;
}

// ─── Helper ────────────────────────────────────────────────────────────────────

async function getActor(storeId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  const staff = await db.storeStaff.findUnique({
    where:  { storeId_userId: { storeId, userId: session.user.id } },
    select: { role: true },
  });
  if (!staff) throw new Error('Kamu tidak terdaftar sebagai staff di toko ini.');
  return { actorId: session.user.id, actorRole: staff.role as StaffRoleValue };
}

// ─── switchTeamMemberRole ──────────────────────────────────────────────────────

export async function switchTeamMemberRole(
  targetUserId: string,
  newRole: SwitchableRole
): Promise<SwitchRoleResult> {
  const { storeId, storeSlug, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    return { success: false, error: 'Unauthorized' };
  }

  const staff = await db.storeStaff.findUnique({
    where: { storeId_userId: { storeId, userId: targetUserId } },
  });
  if (!staff) return { success: false, error: 'Anggota tim tidak ditemukan di store ini' };

  if (staff.role !== 'MANAGER' && staff.role !== 'CASHIER') {
    return { success: false, error: 'Hanya Manager dan Kasir yang bisa dipindah peran' };
  }
  if (staff.role === newRole) {
    return { success: false, error: `Sudah menjadi ${newRole === 'MANAGER' ? 'Manager' : 'Kasir'}` };
  }

  const limit = await checkPlanLimit(newRole === 'MANAGER' ? 'managers' : 'cashiers');
  if (!limit.allowed) {
    const label = newRole === 'MANAGER' ? 'manager' : 'kasir';
    return {
      success: false,
      error:   `Batas ${label} tercapai (${limit.current}/${limit.limit}). Upgrade ke PRO.`,
    };
  }

  await db.storeStaff.update({
    where: { storeId_userId: { storeId, userId: targetUserId } },
    data:  { role: newRole },
  });

  revalidatePath(`/${storeSlug}/admin/settings/profile`);
  return { success: true };
}

// ─── assignStaff (generic) ────────────────────────────────────────────────────

async function assignStaff(
  storeId: string,
  targetUserId: string,
  targetRole: 'MANAGER' | 'CASHIER'
) {
  const { actorRole } = await getActor(storeId);

  if (!canAssignStaffRole(actorRole, targetRole)) {
    throw new Error(`Role kamu (${actorRole}) tidak dapat meng-assign ${targetRole}.`);
  }

  const conflict = await checkStaffConflict(targetUserId, storeId, targetRole);
  if (conflict.hasConflict) throw new Error(conflict.reason);

  const storeStaff = await db.storeStaff.create({
    data: { userId: targetUserId, storeId, role: targetRole },
  });

  return { storeStaff, warning: conflict.isWarning ? conflict.reason : undefined };
}

// ─── createManagerAction ──────────────────────────────────────────────────────

export async function createManagerAction(storeId: string, targetUserId: string) {
  try {
    const result = await assignStaff(storeId, targetUserId, 'MANAGER');
    revalidatePath(`/dashboard/${storeId}/team`);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── createCashierAction ──────────────────────────────────────────────────────

export async function createCashierAction(storeId: string, targetUserId: string) {
  try {
    const result = await assignStaff(storeId, targetUserId, 'CASHIER');
    revalidatePath(`/dashboard/${storeId}/team`);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── updateStoreUserRoleAction ────────────────────────────────────────────────

export async function updateStoreUserRoleAction(
  storeId: string,
  targetUserId: string,
  newRole: StaffRoleValue
) {
  try {
    const { actorId, actorRole } = await getActor(storeId);

    const target = await db.storeStaff.findUnique({
      where: { storeId_userId: { storeId, userId: targetUserId } },
    });
    if (!target) throw new Error('User tidak ditemukan sebagai staff di toko ini.');

    if (target.role === 'OWNER' && actorRole !== 'OWNER') {
      throw new Error('Hanya OWNER yang dapat mengubah role OWNER lain.');
    }
    if (!canAssignStaffRole(actorRole, newRole) && actorId !== targetUserId) {
      throw new Error(`Role kamu (${actorRole}) tidak dapat meng-assign ${newRole}.`);
    }

    const updated = await db.storeStaff.update({
      where: { storeId_userId: { storeId, userId: targetUserId } },
      data:  { role: newRole },
    });

    revalidatePath(`/dashboard/${storeId}/team`);
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── removeStaff / deleteManagerAction / deleteCashierAction ─────────────────

async function removeStaff(
  storeId: string,
  targetUserId: string,
  expectedRole?: StaffRoleValue
) {
  const { actorId, actorRole } = await getActor(storeId);

  const target = await db.storeStaff.findUnique({
    where: { storeId_userId: { storeId, userId: targetUserId } },
  });
  if (!target) throw new Error('User tidak ditemukan sebagai staff di toko ini.');

  if (expectedRole && target.role !== expectedRole) {
    throw new Error(`User ini bukan ${expectedRole} di toko ini.`);
  }

  if (actorId === targetUserId && target.role === 'OWNER') {
    const ownerCount = await db.storeStaff.count({ where: { storeId, role: 'OWNER' } });
    if (ownerCount <= 1) throw new Error('Kamu satu-satunya OWNER. Transfer ownership dulu.');
  }

  if (!canAssignStaffRole(actorRole, target.role as StaffRoleValue) && actorId !== targetUserId) {
    throw new Error(`Role kamu (${actorRole}) tidak dapat menghapus ${target.role}.`);
  }

  await db.storeStaff.delete({ where: { storeId_userId: { storeId, userId: targetUserId } } });
}

export async function deleteManagerAction(storeId: string, targetUserId: string) {
  try {
    await removeStaff(storeId, targetUserId, 'MANAGER');
    revalidatePath(`/dashboard/${storeId}/team`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteCashierAction(storeId: string, targetUserId: string) {
  try {
    await removeStaff(storeId, targetUserId, 'CASHIER');
    revalidatePath(`/dashboard/${storeId}/team`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
