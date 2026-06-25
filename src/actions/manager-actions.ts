'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess, checkPlanLimit, MAX_STORES_PER_USER } from '@/lib/store-context';
import bcrypt from 'bcryptjs';

// FIX: hapus address dari ManagerData — tidak ada di User lagi
export interface ManagerData {
  id:        string;
  name:      string;
  email:     string | null;
  phone:     string;
  createdAt: Date;
}

export async function getManagers(): Promise<ManagerData[]> {
  const { storeId, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    throw new Error('Unauthorized');
  }

  const storeUsers = await db.storeUser.findMany({
    where:   { storeId, role: 'MANAGER' },
    include: {
      user: {
        // FIX: hapus address dari select
        select: { id: true, name: true, email: true, phone: true, createdAt: true },
      },
    },
    orderBy: { user: { name: 'asc' } },
  });

  return storeUsers.map((su) => su.user);
}

export interface CreateManagerResult {
  success:              boolean;
  error?:               string;
  requiresConfirmation?: boolean;
  existingName?:        string;
  linked?:              boolean;
}

export async function createManager(
  // FIX: hapus address dari parameter
  data: { name: string; phone: string; password: string; email?: string },
  linkExisting = false
): Promise<CreateManagerResult> {
  const { storeId, storeSlug, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    return { success: false, error: 'Unauthorized' };
  }

  if (!data.name.trim())  return { success: false, error: 'Nama wajib diisi' };
  if (!data.phone.trim()) return { success: false, error: 'Nomor telepon wajib diisi' };

  const existingUser = await db.user.findFirst({ where: { phone: data.phone } });

  if (existingUser) {
    const existingStoreUser = await db.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId: existingUser.id } },
    });
    if (existingStoreUser) {
      return { success: false, error: `Nomor sudah terdaftar di toko ini atas nama ${existingUser.name}` };
    }

    if (!linkExisting) {
      return {
        success:              false,
        requiresConfirmation: true,
        existingName:         existingUser.name,
        error:                `Nomor HP ini sudah terdaftar atas nama "${existingUser.name}".`,
      };
    }

    const storeCount = await db.storeUser.count({ where: { userId: existingUser.id } });
    if (storeCount >= MAX_STORES_PER_USER) {
      return { success: false, error: `${existingUser.name} sudah tergabung di ${MAX_STORES_PER_USER} toko (batas maksimal).` };
    }

    const limit = await checkPlanLimit('managers');
    if (!limit.allowed) {
      return { success: false, error: `Batas manager tercapai (${limit.current}/${limit.limit}). Upgrade ke PRO.` };
    }

    // FIX: hapus syncGlobalRole dan tx.user.update({ role }) — tidak diperlukan lagi
    await db.storeUser.create({ data: { storeId, userId: existingUser.id, role: 'MANAGER' } });

    revalidatePath(`/${storeSlug}/admin/settings/profile`);
    return { success: true, linked: true, existingName: existingUser.name };
  }

  // ── User belum ada ─────────────────────────────────────────────────────────
  if (data.password.length < 6) return { success: false, error: 'Password minimal 6 karakter' };

  const limit = await checkPlanLimit('managers');
  if (!limit.allowed) {
    return { success: false, error: `Batas manager tercapai (${limit.current}/${limit.limit}). Upgrade ke PRO.` };
  }

  if (data.email) {
    const existingEmail = await db.user.findFirst({ where: { email: data.email } });
    if (existingEmail) return { success: false, error: 'Email sudah digunakan' };
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  await db.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name:     data.name,
        phone:    data.phone,
        password: hashedPassword,
        email:    data.email || null,
        // FIX: hapus role dan address — tidak ada di User lagi
      },
    });

    await tx.storeUser.create({ data: { storeId, userId: newUser.id, role: 'MANAGER' } });
  });

  revalidatePath(`/${storeSlug}/admin/settings/profile`);
  return { success: true, linked: false };
}

export async function updateManager(
  managerId: string,
  // FIX: hapus address dari parameter
  data: { name: string; phone: string; email?: string; newPassword?: string }
) {
  const { storeId, storeSlug, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    throw new Error('Unauthorized');
  }

  const storeUser = await db.storeUser.findUnique({
    where: { storeId_userId: { storeId, userId: managerId } },
  });
  if (!storeUser || storeUser.role !== 'MANAGER') throw new Error('Manager tidak ditemukan di store ini');

  if (!data.name.trim())  throw new Error('Nama wajib diisi');
  if (!data.phone.trim()) throw new Error('Nomor telepon wajib diisi');

  const existingPhone = await db.user.findFirst({ where: { phone: data.phone, NOT: { id: managerId } } });
  if (existingPhone) throw new Error('Nomor telepon sudah digunakan');

  if (data.email) {
    const existingEmail = await db.user.findFirst({ where: { email: data.email, NOT: { id: managerId } } });
    if (existingEmail) throw new Error('Email sudah digunakan');
  }

  // FIX: hapus address dari updateData
  const updateData: Record<string, unknown> = {
    name:  data.name,
    phone: data.phone,
    email: data.email || null,
  };

  if (data.newPassword) {
    if (data.newPassword.length < 6) throw new Error('Password minimal 6 karakter');
    updateData.password = await bcrypt.hash(data.newPassword, 10);
  }

  await db.user.update({ where: { id: managerId }, data: updateData });
  revalidatePath(`/${storeSlug}/admin/settings/profile`);
}

export async function deleteManager(managerId: string) {
  const { storeId, storeSlug, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    throw new Error('Unauthorized');
  }

  const storeUser = await db.storeUser.findUnique({
    where: { storeId_userId: { storeId, userId: managerId } },
  });
  if (!storeUser || storeUser.role !== 'MANAGER') throw new Error('Manager tidak ditemukan di store ini');

  await db.storeUser.delete({ where: { storeId_userId: { storeId, userId: managerId } } });
  // FIX: hapus syncGlobalRole — tidak diperlukan lagi

  revalidatePath(`/${storeSlug}/admin/settings/profile`);
}
