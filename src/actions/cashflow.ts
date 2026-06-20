'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { sanitizeText, sanitizeCategory } from '@/lib/sanitize';
import { requireStoreAccess } from '@/lib/store-context';

export async function createCashflowAction(formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole, userId } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized' };
    }

    const type        = formData.get('type')        as 'INCOME' | 'EXPENSE';
    const amount      = parseFloat(formData.get('amount') as string);
    const category    = sanitizeCategory(formData.get('category') as string);
    const description = sanitizeText(formData.get('description') as string, 300);
    const dateStr     = formData.get('date') as string;
    const time        = (formData.get('time') as string)?.trim() || null;
    const date        = new Date(dateStr);

    if (!type || !amount || !category || !dateStr) return { success: false, error: 'Data tidak lengkap' };
    if (amount <= 0) return { success: false, error: 'Jumlah harus lebih dari 0' };

    await db.cashflow.create({
      data: { storeId, type, amount, category, description, date, time, createdById: userId },
    });

    revalidatePath(`/${storeSlug}/admin/finance/cashflow`);
    revalidatePath(`/${storeSlug}/admin/finance/reports`);
    return { success: true };
  } catch (error) {
    console.error('Cashflow creation error:', error);
    return { success: false, error: 'Gagal mencatat transaksi' };
  }
}

export async function updateCashflowAction(id: string, formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized' };
    }

    // Block editing sale-generated entries
    const cashflow = await db.cashflow.findFirst({ where: { id, storeId } });
    if (!cashflow) return { success: false, error: 'Transaksi tidak ditemukan' };
    if (cashflow.saleId) return { success: false, error: 'Transaksi dari penjualan tidak dapat diedit. Edit melalui menu Transaksi Penjualan.' };

    const type        = formData.get('type')        as 'INCOME' | 'EXPENSE';
    const amount      = parseFloat(formData.get('amount') as string);
    const category    = sanitizeCategory(formData.get('category') as string);
    const description = sanitizeText(formData.get('description') as string, 300);
    const dateStr     = formData.get('date') as string;
    const time        = (formData.get('time') as string)?.trim() || null;
    const date        = new Date(dateStr);

    if (!type || !amount || !category || !dateStr) return { success: false, error: 'Data tidak lengkap' };
    if (amount <= 0) return { success: false, error: 'Jumlah harus lebih dari 0' };

    await db.cashflow.update({ where: { id }, data: { type, amount, category, description, date, time } });

    revalidatePath(`/${storeSlug}/admin/finance/cashflow`);
    revalidatePath(`/${storeSlug}/admin/finance/reports`);
    return { success: true };
  } catch (error) {
    console.error('Cashflow update error:', error);
    return { success: false, error: 'Gagal mengupdate transaksi' };
  }
}

export async function deleteCashflowAction(id: string) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized' };
    }

    const cashflow = await db.cashflow.findFirst({ where: { id, storeId } });
    if (!cashflow) return { success: false, error: 'Transaksi tidak ditemukan' };
    if (cashflow.saleId) return { success: false, error: 'Transaksi dari penjualan tidak dapat dihapus. Hapus melalui menu Transaksi Penjualan.' };

    await db.cashflow.delete({ where: { id } });

    revalidatePath(`/${storeSlug}/admin/finance/cashflow`);
    revalidatePath(`/${storeSlug}/admin/finance/reports`);
    return { success: true };
  } catch (error) {
    console.error('Cashflow delete error:', error);
    return { success: false, error: 'Gagal menghapus transaksi' };
  }
}
