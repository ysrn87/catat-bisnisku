'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess, checkPlanLimit } from '@/lib/store-context';
import bcrypt from 'bcryptjs';

export interface CashierData {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  createdAt: Date;
}

export async function getCashiers(): Promise<CashierData[]> {
  const { storeId, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    throw new Error('Unauthorized');
  }

  // Ambil user yang punya StoreRole CASHIER di store ini
  const storeUsers = await db.storeUser.findMany({
    where: { storeId, role: 'CASHIER' },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, address: true, createdAt: true },
      },
    },
    orderBy: { user: { name: 'asc' } },
  });

  return storeUsers.map((su) => su.user);
}

export async function createCashier(data: {
  name: string;
  phone: string;
  password: string;
  email?: string;
  address?: string;
}) {
  const { storeId, storeSlug, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    throw new Error('Unauthorized');
  }

  // Cek limit cashier
  const limit = await checkPlanLimit('cashiers');
  if (!limit.allowed) {
    throw new Error(`Batas kasir tercapai (${limit.current}/${limit.limit}). Upgrade ke PRO untuk lebih banyak kasir.`);
  }

  if (!data.name.trim())        throw new Error('Nama wajib diisi');
  if (!data.phone.trim())       throw new Error('Nomor telepon wajib diisi');
  if (data.password.length < 6) throw new Error('Password minimal 6 karakter');

  const existingPhone = await db.user.findFirst({ where: { phone: data.phone } });
  if (existingPhone) throw new Error('Nomor telepon sudah digunakan');

  if (data.email) {
    const existingEmail = await db.user.findFirst({ where: { email: data.email } });
    if (existingEmail) throw new Error('Email sudah digunakan');
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  await db.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name:     data.name,
        phone:    data.phone,
        password: hashedPassword,
        role:     'CASHIER',
        email:    data.email   || null,
        address:  data.address || null,
      },
    });

    // Daftarkan sebagai CASHIER di store ini
    await tx.storeUser.create({
      data: { storeId, userId: newUser.id, role: 'CASHIER' },
    });
  });

  revalidatePath(`/${storeSlug}/admin/settings/profile`);
}

export async function updateCashier(
  cashierId: string,
  data: { name: string; phone: string; email?: string; address?: string; newPassword?: string }
) {
  const { storeId, storeSlug, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    throw new Error('Unauthorized');
  }

  // Pastikan cashier ini memang di store kita
  const storeUser = await db.storeUser.findUnique({
    where: { storeId_userId: { storeId, userId: cashierId } },
  });
  if (!storeUser || storeUser.role !== 'CASHIER') throw new Error('Kasir tidak ditemukan di store ini');

  if (!data.name.trim())  throw new Error('Nama wajib diisi');
  if (!data.phone.trim()) throw new Error('Nomor telepon wajib diisi');

  const existingPhone = await db.user.findFirst({ where: { phone: data.phone, NOT: { id: cashierId } } });
  if (existingPhone) throw new Error('Nomor telepon sudah digunakan');

  if (data.email) {
    const existingEmail = await db.user.findFirst({ where: { email: data.email, NOT: { id: cashierId } } });
    if (existingEmail) throw new Error('Email sudah digunakan');
  }

  const updateData: Record<string, unknown> = {
    name:    data.name,
    phone:   data.phone,
    email:   data.email   || null,
    address: data.address || null,
  };

  if (data.newPassword) {
    if (data.newPassword.length < 6) throw new Error('Password minimal 6 karakter');
    updateData.password = await bcrypt.hash(data.newPassword, 10);
  }

  await db.user.update({ where: { id: cashierId }, data: updateData });

  revalidatePath(`/${storeSlug}/admin/settings/profile`);
}

export async function deleteCashier(cashierId: string) {
  const { storeId, storeSlug, storeRole } = await requireStoreAccess();

  if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
    throw new Error('Unauthorized');
  }

  const storeUser = await db.storeUser.findUnique({
    where: { storeId_userId: { storeId, userId: cashierId } },
  });
  if (!storeUser || storeUser.role !== 'CASHIER') throw new Error('Kasir tidak ditemukan di store ini');

  // Hapus StoreUser saja (user-nya tetap ada, mungkin punya store lain)
  await db.storeUser.delete({
    where: { storeId_userId: { storeId, userId: cashierId } },
  });

  revalidatePath(`/${storeSlug}/admin/settings/profile`);
}
