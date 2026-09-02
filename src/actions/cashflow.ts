'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { sanitizeText, sanitizeCategory } from '@/lib/sanitize';
import { requireStoreAccess } from '@/lib/store-context';
import { generateCashflowJournal, deleteJournalsBySource } from '@/modules/accounting/lib/journal-engine';

export async function createCashflowAction(formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();
    // FIX: userId tidak diperlukan lagi (createdById dihapus dari skema)

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized' };
    }

    const type        = formData.get('type')        as 'INCOME' | 'EXPENSE';
    const amount      = parseFloat(formData.get('amount') as string);
    const category    = sanitizeCategory(formData.get('category') as string);
    const description = sanitizeText(formData.get('description') as string, 300);
    // FIX: gabungkan date + time menjadi occurredAt
    const dateStr     = formData.get('date') as string;
    const timeStr     = (formData.get('time') as string)?.trim();
    const occurredAt  = timeStr
      ? new Date(`${dateStr}T${timeStr}`)
      : new Date(dateStr);

    if (!type || !amount || !category || !dateStr) return { success: false, error: 'Data tidak lengkap' };
    if (amount <= 0) return { success: false, error: 'Jumlah harus lebih dari 0' };

    const created = await db.cashflow.create({
      data: {
        storeId,
        type,
        amount,
        category,
        description,
        occurredAt, // FIX: was date + time terpisah
        // FIX: hapus createdById
      },
    });

    // Generate jurnal akuntansi — non-blocking
    generateCashflowJournal({
      storeId,
      cashflowId:    created.id,
      type,
      category,
      amount,
      paymentMethod: 'CASH',
      date:          occurredAt,
      description:   description || `${type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} - ${category}`,
    }).catch((err) => console.warn('Journal generation skipped:', err.message));

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

    const cashflow = await db.cashflow.findFirst({ where: { id, storeId } });
    if (!cashflow) return { success: false, error: 'Transaksi tidak ditemukan' };
    if (cashflow.saleId) return { success: false, error: 'Transaksi dari penjualan tidak dapat diedit.' };

    const type        = formData.get('type')        as 'INCOME' | 'EXPENSE';
    const amount      = parseFloat(formData.get('amount') as string);
    const category    = sanitizeCategory(formData.get('category') as string);
    const description = sanitizeText(formData.get('description') as string, 300);
    const dateStr     = formData.get('date') as string;
    const timeStr     = (formData.get('time') as string)?.trim();
    const occurredAt  = timeStr
      ? new Date(`${dateStr}T${timeStr}`)
      : new Date(dateStr);

    if (!type || !amount || !category || !dateStr) return { success: false, error: 'Data tidak lengkap' };
    if (amount <= 0) return { success: false, error: 'Jumlah harus lebih dari 0' };

    await db.cashflow.update({
      where: { id },
      data:  { type, amount, category, description, occurredAt },
    });

    // Re-generate jurnal — non-blocking
    generateCashflowJournal({
      storeId,
      cashflowId:    id,
      type,
      category,
      amount,
      paymentMethod: 'CASH',
      date:          occurredAt,
      description:   description || `${type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} - ${category}`,
    }).catch((err) => console.warn('Journal re-generation skipped:', err.message));

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
    if (cashflow.saleId) return { success: false, error: 'Transaksi dari penjualan tidak dapat dihapus.' };

    await db.cashflow.delete({ where: { id } });

    // Hapus jurnal terkait — non-blocking
    deleteJournalsBySource('CASHFLOW', id)
      .catch((err) => console.warn('Journal deletion skipped:', err.message));

    revalidatePath(`/${storeSlug}/admin/finance/cashflow`);
    revalidatePath(`/${storeSlug}/admin/finance/reports`);
    return { success: true };
  } catch (error) {
    console.error('Cashflow delete error:', error);
    return { success: false, error: 'Gagal menghapus transaksi' };
  }
}
