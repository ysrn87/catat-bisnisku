'use server';

import { db } from '@/lib/db';
import crypto from 'crypto';
import { type StaffRoleValue, canAssignStaffRole } from '@/lib/role-guard';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess, checkPlanLimit } from '@/lib/store-context';
import {
  sendEmail,
  getAppUrl,
  staffInvitationExistingUserTemplate,
  staffInvitationNewUserTemplate,
} from '@/lib/email';

const INVITATION_EXPIRES_DAYS = 7;
const ROLE_LABEL: Record<string, string> = {
  MANAGER:       'Manager',
  CASHIER:       'Kasir',
  ADMINISTRATOR: 'Administrator',
};

// ─────────────────────────────────────────────────────────────────────────────
// inviteStaffAction
// Menggantikan createManagerAction + createCashierAction.
// Tidak langsung buat StoreStaff — kirim undangan via email dulu.
// ─────────────────────────────────────────────────────────────────────────────

export async function inviteStaffAction(
  email: string,
  role: 'MANAGER' | 'CASHIER'
): Promise<{ success: boolean; error?: string; warning?: string }> {
  try {
    const { storeId, storeSlug, storeRole, userId } = await requireStoreAccess();

    // Hanya OWNER dan ADMINISTRATOR yang bisa undang
    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Kamu tidak memiliki izin untuk mengundang anggota tim.' };
    }

    if (!canAssignStaffRole(storeRole as StaffRoleValue, role)) {
      return { success: false, error: `Role kamu (${storeRole}) tidak dapat mengundang ${role}.` };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return { success: false, error: 'Format email tidak valid.' };
    }

    // Cek batas plan
    const limit = await checkPlanLimit(role === 'MANAGER' ? 'managers' : 'cashiers');
    if (!limit.allowed) {
      return {
        success: false,
        error: `Batas ${ROLE_LABEL[role]} tercapai (${limit.current}/${limit.limit}). Upgrade ke PRO.`,
      };
    }

    // Cek apakah sudah jadi staff di toko ini
    const existingUser = await db.user.findUnique({
      where:  { email: normalizedEmail },
      select: { id: true, name: true, emailVerified: true },
    });

    if (existingUser) {
      const alreadyStaff = await db.storeStaff.findUnique({
        where: { storeId_userId: { storeId, userId: existingUser.id } },
      });
      if (alreadyStaff) {
        return {
          success: false,
          error: `${normalizedEmail} sudah terdaftar di toko ini sebagai ${ROLE_LABEL[alreadyStaff.role] ?? alreadyStaff.role}.`,
        };
      }
    }

    // Cek apakah sudah ada undangan pending untuk email + toko ini
    const existingInvitation = await db.staffInvitation.findFirst({
      where: { storeId, email: normalizedEmail, status: 'PENDING' },
    });
    if (existingInvitation) {
      return {
        success: false,
        error: `Undangan untuk ${normalizedEmail} sudah dikirim dan masih menunggu respons.`,
      };
    }

    // Ambil data store & inviter untuk email
    const [store, inviter] = await Promise.all([
      db.store.findUnique({ where: { id: storeId }, select: { name: true } }),
      db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    const appUrl    = getAppUrl();
    const expiresIn = `${INVITATION_EXPIRES_DAYS} hari`;

    // Buat invitation record
    await db.staffInvitation.create({
      data: {
        storeId,
        email:       normalizedEmail,
        role,
        invitedById: userId,
        token,
        expiresAt,
      },
    });

    // Kirim email sesuai status user
    if (existingUser) {
      // User sudah terdaftar → kirim link accept/decline
      const acceptLink  = `${appUrl}/invitation?token=${token}&action=accept`;
      const declineLink = `${appUrl}/invitation?token=${token}&action=decline`;
      const { subject, html } = staffInvitationExistingUserTemplate({
        name:        existingUser.name,
        storeName:   store!.name,
        inviterName: inviter!.name,
        role,
        acceptLink,
        declineLink,
        expiresIn,
      });
      await sendEmail({ to: normalizedEmail, subject, html });
    } else {
      // User belum terdaftar → kirim link register dengan invitation token
      const registerLink = `${appUrl}/register?invitationToken=${token}`;
      const { subject, html } = staffInvitationNewUserTemplate({
        storeName:   store!.name,
        inviterName: inviter!.name,
        role,
        registerLink,
        expiresIn,
      });
      await sendEmail({ to: normalizedEmail, subject, html });
    }

    revalidatePath(`/${storeSlug}/admin/settings/profile`);
    return { success: true };

  } catch (err) {
    console.error('[inviteStaffAction]', err);
    return { success: false, error: 'Terjadi kesalahan. Silakan coba lagi.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// respondInvitationAction
// Dipanggil dari halaman /invitation?token=xxx
// ─────────────────────────────────────────────────────────────────────────────

export async function respondInvitationAction(
  token: string,
  accept: boolean
): Promise<{ success: boolean; error?: string; storeSlug?: string }> {
  try {
    const session = await import('@/auth').then((m) => m.auth());
    if (!session?.user?.id) {
      return { success: false, error: 'Kamu harus login terlebih dahulu.' };
    }

    const invitation = await db.staffInvitation.findUnique({
      where:   { token },
      include: { store: { select: { slug: true, name: true } } },
    });

    if (!invitation) {
      return { success: false, error: 'Undangan tidak ditemukan atau sudah tidak valid.' };
    }
    if (invitation.status !== 'PENDING') {
      return { success: false, error: `Undangan ini sudah ${invitation.status === 'ACCEPTED' ? 'diterima' : 'ditolak'}.` };
    }
    if (invitation.expiresAt < new Date()) {
      await db.staffInvitation.update({ where: { token }, data: { status: 'EXPIRED' } });
      return { success: false, error: 'Undangan ini sudah kedaluwarsa.' };
    }

    // Verifikasi bahwa user yang login adalah pemilik email undangan
    const user = await db.user.findUnique({
      where:  { id: session.user.id },
      select: { email: true },
    });
    if (user?.email !== invitation.email) {
      return { success: false, error: 'Undangan ini bukan untuk akun kamu.' };
    }

    if (!accept) {
      await db.staffInvitation.update({
        where: { token },
        data:  { status: 'DECLINED', respondedAt: new Date() },
      });
      return { success: true };
    }

    // Terima undangan → buat StoreStaff
    await db.$transaction(async (tx) => {
      await tx.storeStaff.create({
        data: {
          storeId: invitation.storeId,
          userId:  session.user!.id!,
          role:    invitation.role,
        },
      });
      await tx.staffInvitation.update({
        where: { token },
        data:  { status: 'ACCEPTED', respondedAt: new Date() },
      });
    });

    return { success: true, storeSlug: invitation.store.slug };

  } catch (err) {
    console.error('[respondInvitationAction]', err);
    return { success: false, error: 'Terjadi kesalahan. Silakan coba lagi.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// switchTeamMemberRole — tidak berubah, tetap dipakai
// ─────────────────────────────────────────────────────────────────────────────

export async function switchTeamMemberRole(
  targetUserId: string,
  newRole: 'MANAGER' | 'CASHIER'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized' };
    }

    const staff = await db.storeStaff.findUnique({
      where: { storeId_userId: { storeId, userId: targetUserId } },
    });
    if (!staff) return { success: false, error: 'Anggota tim tidak ditemukan di toko ini.' };
    if (staff.role !== 'MANAGER' && staff.role !== 'CASHIER') {
      return { success: false, error: 'Hanya Manager dan Kasir yang bisa dipindah peran.' };
    }
    if (staff.role === newRole) {
      return { success: false, error: `Sudah menjadi ${ROLE_LABEL[newRole]}.` };
    }

    const limit = await checkPlanLimit(newRole === 'MANAGER' ? 'managers' : 'cashiers');
    if (!limit.allowed) {
      return {
        success: false,
        error: `Batas ${ROLE_LABEL[newRole]} tercapai (${limit.current}/${limit.limit}). Upgrade ke PRO.`,
      };
    }

    await db.storeStaff.update({
      where: { storeId_userId: { storeId, userId: targetUserId } },
      data:  { role: newRole },
    });

    revalidatePath(`/${storeSlug}/admin/settings/profile`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// removeStaffAction — menggantikan deleteManagerAction + deleteCashierAction
// ─────────────────────────────────────────────────────────────────────────────

export async function removeStaffAction(
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { storeId, storeSlug, storeRole, userId } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Kamu tidak memiliki izin untuk menghapus anggota tim.' };
    }

    const target = await db.storeStaff.findUnique({
      where: { storeId_userId: { storeId, userId: targetUserId } },
    });
    if (!target) return { success: false, error: 'Anggota tim tidak ditemukan di toko ini.' };

    // Tidak boleh hapus OWNER kecuali diri sendiri (dan hanya jika ada owner lain)
    if (target.role === 'OWNER') {
      if (userId !== targetUserId) {
        return { success: false, error: 'Tidak bisa menghapus OWNER lain.' };
      }
      const ownerCount = await db.storeStaff.count({ where: { storeId, role: 'OWNER' } });
      if (ownerCount <= 1) {
        return { success: false, error: 'Kamu satu-satunya OWNER. Transfer ownership dulu sebelum keluar.' };
      }
    }

    await db.storeStaff.delete({
      where: { storeId_userId: { storeId, userId: targetUserId } },
    });

    revalidatePath(`/${storeSlug}/admin/settings/profile`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// cancelInvitationAction — batalkan undangan yang masih PENDING
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelInvitationAction(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized' };
    }

    const invitation = await db.staffInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation || invitation.storeId !== storeId) {
      return { success: false, error: 'Undangan tidak ditemukan.' };
    }
    if (invitation.status !== 'PENDING') {
      return { success: false, error: 'Undangan ini sudah tidak aktif.' };
    }

    await db.staffInvitation.update({
      where: { id: invitationId },
      data:  { status: 'EXPIRED' },
    });

    revalidatePath(`/${storeSlug}/admin/settings/profile`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// Backward-compat — hapus bertahap setelah UI diupdate
/** @deprecated gunakan removeStaffAction */
export async function deleteManagerAction(_storeId: string, targetUserId: string) {
  return removeStaffAction(targetUserId);
}
/** @deprecated gunakan removeStaffAction */
export async function deleteCashierAction(_storeId: string, targetUserId: string) {
  return removeStaffAction(targetUserId);
}
