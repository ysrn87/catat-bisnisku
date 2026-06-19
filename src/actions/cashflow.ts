'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { sanitizeText, sanitizeCategory } from '@/lib/sanitize';
import { requireStoreAccess } from '@/lib/store-context';

export async function createCashflowAction(formData: FormData) {
  try {
    const { storeId, storeSlug, userId } = await requireStoreAccess();

    const type        = formData.get('type')        as 'INCOME' | 'EXPENSE';
    const amount      = parseFloat(formData.get('amount') as string);
    const category    = sanitizeCategory(formData.get('category') as string);
    const description = sanitizeText(formData.get('description') as string, 300);
    const date        = new Date(formData.get('date') as string);

    if (!type || !amount || !category || !date) return { success: false, error: 'Data tidak lengkap' };
    if (amount <= 0) return { success: false, error: 'Jumlah harus lebih dari 0' };

    await db.cashflow.create({
      data: { storeId, type, amount, category, description, date, createdById: userId },
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
    const { storeId, storeSlug } = await requireStoreAccess();

    const type        = formData.get('type')        as 'INCOME' | 'EXPENSE';
    const amount      = parseFloat(formData.get('amount') as string);
    const category    = sanitizeCategory(formData.get('category') as string);
    const description = sanitizeText(formData.get('description') as string, 300);
    const date        = new Date(formData.get('date') as string);

    if (!type || !amount || !category || !date) return { success: false, error: 'Data tidak lengkap' };
    if (amount <= 0) return { success: false, error: 'Jumlah harus lebih dari 0' };

    const cashflow = await db.cashflow.findFirst({ where: { id, storeId } });
    if (!cashflow) return { success: false, error: 'Transaksi tidak ditemukan' };

    await db.cashflow.update({ where: { id }, data: { type, amount, category, description, date } });

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
    const { storeId, storeSlug } = await requireStoreAccess();

    const cashflow = await db.cashflow.findFirst({ where: { id, storeId } });
    if (!cashflow) return { success: false, error: 'Transaksi tidak ditemukan' };

    await db.cashflow.delete({ where: { id } });

    revalidatePath(`/${storeSlug}/admin/finance/cashflow`);
    revalidatePath(`/${storeSlug}/admin/finance/reports`);
    return { success: true };
  } catch (error) {
    console.error('Cashflow delete error:', error);
    return { success: false, error: 'Gagal menghapus transaksi' };
  }
}
