'use server';

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTING ACTIONS
// Server actions untuk operasi modul akuntansi
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '@/lib/db';
import { requireStoreAccess } from '@/lib/store-context';
import { seedDefaultAccounts } from '@/modules/accounting/lib/journal-engine';
import {
  getLedger,
  getProfitLossReport,
  getTrialBalance,
  type DateRange,
} from '@/modules/accounting/lib/accounting-service';

// ─────────────────────────────────────────────────────────────────────────────
// SEED CoA — dipanggil saat store baru dibuat
// Tambahkan ini ke register-store action yang sudah ada
// ─────────────────────────────────────────────────────────────────────────────

export async function initAccountingForStore(storeId: string): Promise<void> {
  await seedDefaultAccounts(storeId);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ACCOUNTS — untuk dropdown/settings
// ─────────────────────────────────────────────────────────────────────────────

export async function getAccountsAction() {
  try {
    const { storeId } = await requireStoreAccess();

    const accounts = await db.account.findMany({
      where:   { storeId, isActive: true },
      orderBy: { code: 'asc' },
    });

    return { success: true, data: accounts };
  } catch {
    return { success: false, error: 'Gagal memuat daftar akun' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET BUKU BESAR
// ─────────────────────────────────────────────────────────────────────────────

export async function getLedgerAction(params: {
  dateFrom?:   string;
  dateTo?:     string;
  accountCode?: string;
}) {
  try {
    const { storeId, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const range: DateRange = {
      from: params.dateFrom ? new Date(params.dateFrom) : undefined,
      to:   params.dateTo   ? new Date(params.dateTo + 'T23:59:59') : undefined,
    };

    const data = await getLedger(storeId, range, params.accountCode);
    return { success: true, data };
  } catch (error) {
    console.error('getLedgerAction error:', error);
    return { success: false, error: 'Gagal memuat buku besar' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET LABA RUGI
// ─────────────────────────────────────────────────────────────────────────────

export async function getProfitLossAction(params: {
  dateFrom?: string;
  dateTo?:   string;
}) {
  try {
    const { storeId, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const range: DateRange = {
      from: params.dateFrom ? new Date(params.dateFrom) : undefined,
      to:   params.dateTo   ? new Date(params.dateTo + 'T23:59:59') : undefined,
    };

    const data = await getProfitLossReport(storeId, range);
    return { success: true, data };
  } catch (error) {
    console.error('getProfitLossAction error:', error);
    return { success: false, error: 'Gagal memuat laporan laba rugi' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET NERACA SALDO
// ─────────────────────────────────────────────────────────────────────────────

export async function getTrialBalanceAction(params: {
  dateFrom?: string;
  dateTo?:   string;
}) {
  try {
    const { storeId, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const range: DateRange = {
      from: params.dateFrom ? new Date(params.dateFrom) : undefined,
      to:   params.dateTo   ? new Date(params.dateTo + 'T23:59:59') : undefined,
    };

    const data = await getTrialBalance(storeId, range);
    return { success: true, data };
  } catch (error) {
    console.error('getTrialBalanceAction error:', error);
    return { success: false, error: 'Gagal memuat neraca saldo' };
  }
}

// Dipanggil dari UI untuk store yang sudah ada sebelum modul akuntansi dipasang
export async function seedAccountingForCurrentStore() {
  try {
    const { storeId, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    // Cek apakah sudah punya akun
    const existingCount = await db.account.count({ where: { storeId } });
    if (existingCount > 0) {
      return { success: true, message: `CoA sudah ada (${existingCount} akun)`, alreadySeeded: true };
    }

    await seedDefaultAccounts(storeId);

    const count = await db.account.count({ where: { storeId } });
    return { success: true, message: `Berhasil membuat ${count} akun default`, alreadySeeded: false };
  } catch (error) {
    console.error('seedAccountingForCurrentStore error:', error);
    return { success: false, error: 'Gagal seed Chart of Accounts' };
  }
}
