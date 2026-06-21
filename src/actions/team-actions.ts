'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess, checkPlanLimit } from '@/lib/store-context';

type SwitchableRole = 'MANAGER' | 'CASHIER';

export interface SwitchRoleResult {
  success: boolean;
  error?: string;
}

/**
 * Pindahkan peran seorang anggota tim antara Manager <-> Kasir di store yang sama,
 * tanpa hapus-lalu-buat-ulang akun (yang sebelumnya gagal karena nomor telepon
 * sudah terpakai oleh akun lama).
 */
export async function switchTeamMemberRole(
  memberId: string,
  newRole: SwitchableRole
): Promise<SwitchRoleResult> {
  const { storeId, storeSlug, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    return { success: false, error: 'Unauthorized' };
  }

  const storeUser = await db.storeUser.findUnique({
    where: { storeId_userId: { storeId, userId: memberId } },
  });
  if (!storeUser) return { success: false, error: 'Anggota tim tidak ditemukan di store ini' };

  if (storeUser.role !== 'MANAGER' && storeUser.role !== 'CASHIER') {
    return { success: false, error: 'Hanya Manager dan Kasir yang bisa dipindah peran' };
  }
  if (storeUser.role === newRole) {
    return { success: false, error: `Sudah menjadi ${newRole === 'MANAGER' ? 'Manager' : 'Kasir'}` };
  }

  // Cek kuota plan untuk peran tujuan
  const limit = await checkPlanLimit(newRole === 'MANAGER' ? 'managers' : 'cashiers');
  if (!limit.allowed) {
    const label = newRole === 'MANAGER' ? 'manager' : 'kasir';
    return {
      success: false,
      error: `Batas ${label} tercapai (${limit.current}/${limit.limit}). Upgrade ke PRO untuk lebih banyak ${label}.`,
    };
  }

  await db.$transaction(async (tx) => {
    await tx.storeUser.update({
      where: { storeId_userId: { storeId, userId: memberId } },
      data: { role: newRole },
    });
    // Sinkronkan Role global (dipakai beberapa flag UI ringan)
    await tx.user.update({ where: { id: memberId }, data: { role: newRole } });
  });

  revalidatePath(`/${storeSlug}/admin/settings/profile`);
  return { success: true };
}
