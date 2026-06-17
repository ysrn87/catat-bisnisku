'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { sanitizeName, sanitizeText } from '@/lib/sanitize';
import { requireStoreAccess } from '@/lib/store-context';

const normalizePhone = (phone: string) =>
  phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

export async function createNonMemberCustomerAction(formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
      return { success: false, error: 'Unauthorized' };
    }

    const name    = formData.get('name')    as string;
    const phone   = normalizePhone(formData.get('phone') as string);
    const address = formData.get('address') as string;

    if (!name || !phone || !address) return { success: false, error: 'Nama, telepon, dan alamat wajib diisi' };
    if (phone.length < 10 || phone.length > 15) return { success: false, error: 'Nomor telepon tidak valid' };

    // Cek duplikat phone per store (tidak cek store lain)
    const existing = await db.customer.findUnique({ where: { storeId_phone: { storeId, phone } } });
    if (existing) return { success: false, error: 'Nomor telepon sudah terdaftar sebagai customer' };

    const customer = await db.customer.create({ data: { storeId, name, phone, address } });

    revalidatePath(`/${storeSlug}/admin/sales-customers/customers`);
    revalidatePath(`/${storeSlug}/manager/sales-customers/customers`);
    return { success: true, data: customer };
  } catch (error) {
    console.error('Create non-member customer error:', error);
    return { success: false, error: 'Gagal membuat customer' };
  }
}

export async function getAllNonMemberCustomers() {
  try {
    const { storeId, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
      throw new Error('Unauthorized');
    }

    return db.customer.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      include: {
        sales: { select: { id: true, total: true } },
        _count: { select: { sales: true } },
      },
    });
  } catch (error) {
    console.error('Get non-member customers error:', error);
    throw error;
  }
}

export async function getCustomerPurchaseHistory(customerId: string, isNonMember = false) {
  try {
    const { storeId, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
      throw new Error('Unauthorized');
    }

    const sales = await db.sale.findMany({
      where: {
        storeId,
        ...(isNonMember ? { nonMemberCustomerId: customerId } : { customerId }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        cashier: { select: { name: true } },
      },
    });

    return sales.map((sale) => {
      const { subtotal, discount, tax, total, items, ...rest } = sale;
      const ongkir = (rest as any).ongkir;
      delete (rest as any).ongkir;
      return {
        ...rest,
        subtotal: Number(subtotal),
        discount: Number(discount),
        tax:      Number(tax),
        ongkir:   Number(ongkir),
        total:    Number(total),
        items: items.map((item) => {
          const { price, subtotal: s, variant, ...ir } = item;
          const { price: vp, cost: vc, ...vr } = variant;
          return { ...ir, price: Number(price), subtotal: Number(s), variant: { ...vr, price: Number(vp), cost: Number(vc) } };
        }),
      };
    });
  } catch (error) {
    console.error('Get purchase history error:', error);
    throw error;
  }
}

export async function upgradeToMemberAction(customerId: string, formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized - Admin access required' };
    }

    const password = formData.get('password') as string;
    const email    = formData.get('email')    as string;
    const birthday = formData.get('birthday') as string;
    const photoUrl = formData.get('photoUrl') as string;
    const name     = sanitizeName(formData.get('name') as string, 100);
    const phone    = (formData.get('phone') as string)?.trim();
    const address  = sanitizeText(formData.get('address') as string, 200);

    if (!password || password.length < 6) return { success: false, error: 'Password wajib diisi (min. 6 karakter)' };
    if (!name)    return { success: false, error: 'Nama wajib diisi' };
    if (!phone)   return { success: false, error: 'Nomor telepon wajib diisi' };
    if (!address) return { success: false, error: 'Alamat wajib diisi' };

    const customer = await db.customer.findFirst({ where: { id: customerId, storeId }, include: { sales: true } });
    if (!customer) return { success: false, error: 'Customer tidak ditemukan' };

    const existingPhone = await db.user.findFirst({ where: { phone } });
    if (existingPhone) return { success: false, error: 'Nomor telepon sudah terdaftar sebagai member' };

    if (email) {
      const existingEmail = await db.user.findFirst({ where: { email: email.trim().toLowerCase() } });
      if (existingEmail) return { success: false, error: 'Email sudah terdaftar' };
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name, phone, address,
          email:    email ? email.trim().toLowerCase() : null,
          birthday: birthday ? new Date(birthday) : null,
          photoUrl: photoUrl || null,
          password: hashedPassword,
          role:     'MEMBER',
          points:   0,
        },
      });

      // Daftarkan ke store sebagai MEMBER
      await tx.storeUser.create({
        data: { storeId, userId: newUser.id, role: 'MEMBER' },
      });

      // Transfer sales
      if (customer.sales.length > 0) {
        await tx.sale.updateMany({
          where: { nonMemberCustomerId: customerId, storeId },
          data:  { customerId: newUser.id, nonMemberCustomerId: null },
        });
      }

      await tx.customer.delete({ where: { id: customerId } });
    });

    revalidatePath(`/${storeSlug}/admin/sales-customers/customers`);
    revalidatePath(`/${storeSlug}/manager/sales-customers/customers`);
    return { success: true };
  } catch (error) {
    console.error('Upgrade to member error:', error);
    return { success: false, error: 'Gagal upgrade customer ke member' };
  }
}

export async function updateNonMemberCustomerAction(customerId: string, formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
      return { success: false, error: 'Unauthorized' };
    }

    const name    = (formData.get('name')    as string)?.trim();
    const phone   = normalizePhone(formData.get('phone') as string);
    const address = (formData.get('address') as string)?.trim();

    if (!name || !phone || !address) return { success: false, error: 'Nama, telepon, dan alamat wajib diisi' };
    if (phone.length < 10 || phone.length > 15) return { success: false, error: 'Nomor telepon tidak valid' };

    const customer = await db.customer.findFirst({ where: { id: customerId, storeId } });
    if (!customer) return { success: false, error: 'Customer tidak ditemukan' };

    const existing = await db.customer.findFirst({
      where: { storeId_phone: { storeId, phone }, NOT: { id: customerId } },
    });
    if (existing) return { success: false, error: 'Nomor telepon sudah digunakan customer lain' };

    await db.customer.update({ where: { id: customerId }, data: { name, phone, address } });

    revalidatePath(`/${storeSlug}/admin/sales-customers/customers`);
    revalidatePath(`/${storeSlug}/manager/sales-customers/customers`);
    return { success: true };
  } catch (error) {
    console.error('Update non-member customer error:', error);
    return { success: false, error: 'Gagal mengupdate customer' };
  }
}

export async function deleteNonMemberCustomerAction(customerId: string) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized - Admin access required' };
    }

    const customer = await db.customer.findFirst({ where: { id: customerId, storeId } });
    if (!customer) return { success: false, error: 'Customer tidak ditemukan' };

    const salesCount = await db.sale.count({ where: { nonMemberCustomerId: customerId, storeId } });
    if (salesCount > 0) return { success: false, error: 'Tidak bisa hapus customer yang punya riwayat penjualan' };

    await db.customer.delete({ where: { id: customerId } });

    revalidatePath(`/${storeSlug}/admin/sales-customers/customers`);
    revalidatePath(`/${storeSlug}/manager/sales-customers/customers`);
    return { success: true };
  } catch (error) {
    console.error('Delete non-member customer error:', error);
    return { success: false, error: 'Gagal menghapus customer' };
  }
}
