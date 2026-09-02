'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess } from '@/lib/store-context';
import { sanitizeText } from '@/lib/sanitize';

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

// Validasi kode akun sesuai konvensi
// ASSET=1xxx, LIABILITY=2xxx, EQUITY=3xxx, REVENUE=4xxx, EXPENSE=5xxx
const TYPE_CODE_PREFIX: Record<AccountType, string> = {
  ASSET:     '1',
  LIABILITY: '2',
  EQUITY:    '3',
  REVENUE:   '4',
  EXPENSE:   '5',
};

function validateCode(code: string, type: AccountType): string | null {
  if (!/^\d{4}$/.test(code)) return 'Kode akun harus 4 digit angka';
  const expected = TYPE_CODE_PREFIX[type];
  if (!code.startsWith(expected)) {
    return `Kode akun untuk tipe "${type}" harus diawali ${expected} (misal: ${expected}001–${expected}999)`;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ACCOUNTS
// ─────────────────────────────────────────────────────────────────────────────

export async function getAccountsAction() {
  try {
    const { storeId } = await requireStoreAccess();
    const accounts = await db.account.findMany({
      where:   { storeId },
      orderBy: { code: 'asc' },
    });
    return { success: true, data: accounts };
  } catch {
    return { success: false, error: 'Gagal memuat daftar akun' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE ACCOUNT
// ─────────────────────────────────────────────────────────────────────────────

export async function createAccountAction(formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const code = (formData.get('code') as string)?.trim();
    const name = sanitizeText(formData.get('name') as string, 100);
    const type = formData.get('type') as AccountType;

    if (!code || !name || !type) {
      return { success: false, error: 'Semua field wajib diisi' };
    }

    const codeError = validateCode(code, type);
    if (codeError) return { success: false, error: codeError };

    // Cek duplikat kode
    const existing = await db.account.findUnique({
      where: { storeId_code: { storeId, code } },
    });
    if (existing) return { success: false, error: `Kode akun ${code} sudah digunakan` };

    await db.account.create({
      data: { storeId, code, name, type, isSystem: false, isActive: true },
    });

    revalidatePath(`/${storeSlug}/admin/accounting/accounts`);
    return { success: true };
  } catch (error) {
    console.error('createAccountAction error:', error);
    return { success: false, error: 'Gagal membuat akun' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE ACCOUNT
// ─────────────────────────────────────────────────────────────────────────────

export async function updateAccountAction(id: string, formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const account = await db.account.findFirst({ where: { id, storeId } });
    if (!account) return { success: false, error: 'Akun tidak ditemukan' };

    const code = (formData.get('code') as string)?.trim();
    const name = sanitizeText(formData.get('name') as string, 100);
    const type = formData.get('type') as AccountType;

    if (!code || !name || !type) {
      return { success: false, error: 'Semua field wajib diisi' };
    }

    // System accounts: hanya boleh edit nama, tidak boleh ganti kode/tipe
    if (account.isSystem) {
      await db.account.update({
        where: { id },
        data:  { name },
      });
      revalidatePath(`/${storeSlug}/admin/accounting/accounts`);
      return { success: true };
    }

    const codeError = validateCode(code, type);
    if (codeError) return { success: false, error: codeError };

    // Cek duplikat kode (kecuali akun ini sendiri)
    const duplicate = await db.account.findFirst({
      where: { storeId, code, NOT: { id } },
    });
    if (duplicate) return { success: false, error: `Kode akun ${code} sudah digunakan` };

    await db.account.update({
      where: { id },
      data:  { code, name, type },
    });

    revalidatePath(`/${storeSlug}/admin/accounting/accounts`);
    return { success: true };
  } catch (error) {
    console.error('updateAccountAction error:', error);
    return { success: false, error: 'Gagal mengupdate akun' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE ACTIVE (soft delete — tidak bisa hapus yang punya jurnal)
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleAccountActiveAction(id: string) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const account = await db.account.findFirst({ where: { id, storeId } });
    if (!account) return { success: false, error: 'Akun tidak ditemukan' };

    if (account.isSystem) {
      return { success: false, error: 'Akun sistem tidak dapat dinonaktifkan' };
    }

    // Cek apakah ada jurnal yang menggunakan akun ini
    const journalCount = await db.journalEntry.count({
      where: { OR: [{ debitId: id }, { creditId: id }] },
    });

    if (journalCount > 0 && account.isActive) {
      return {
        success: false,
        error:   `Akun ini digunakan di ${journalCount} jurnal dan tidak dapat dinonaktifkan. Hapus jurnal terkait terlebih dahulu.`,
      };
    }

    await db.account.update({
      where: { id },
      data:  { isActive: !account.isActive },
    });

    revalidatePath(`/${storeSlug}/admin/accounting/accounts`);
    return { success: true, newState: !account.isActive };
  } catch (error) {
    console.error('toggleAccountActiveAction error:', error);
    return { success: false, error: 'Gagal mengubah status akun' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE ACCOUNT (hard delete — hanya akun tanpa jurnal dan non-system)
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteAccountAction(id: string) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const account = await db.account.findFirst({ where: { id, storeId } });
    if (!account) return { success: false, error: 'Akun tidak ditemukan' };
    if (account.isSystem) return { success: false, error: 'Akun sistem tidak dapat dihapus' };

    const journalCount = await db.journalEntry.count({
      where: { OR: [{ debitId: id }, { creditId: id }] },
    });

    if (journalCount > 0) {
      return {
        success: false,
        error:   `Akun ini digunakan di ${journalCount} jurnal dan tidak dapat dihapus.`,
      };
    }

    await db.account.delete({ where: { id } });

    revalidatePath(`/${storeSlug}/admin/accounting/accounts`);
    return { success: true };
  } catch (error) {
    console.error('deleteAccountAction error:', error);
    return { success: false, error: 'Gagal menghapus akun' };
  }
}
