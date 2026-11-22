'use server';

import { revalidatePath } from 'next/cache';
import { del } from '@vercel/blob';
import { db } from '@/lib/db';
import { requireStoreAccess } from '@/lib/store-context';
import {
  MAX_ACCOUNTS_PER_TYPE,
  PAYMENT_ACCOUNT_TYPE_LABEL,
  isSafeBlobUrl,
  validatePaymentAccountInput,
  type PaymentAccountInfo,
  type PaymentAccountInput,
  type PaymentAccountType,
} from '@/lib/payment-accounts';

type ActionResult<T = object> = ({ success: true } & T) | { success: false; error: string };

const ADMIN_ROLES = ['OWNER', 'ADMINISTRATOR'];

const SELECT = {
  id: true, type: true, provider: true, accountNumber: true,
  accountName: true, qrisImageUrl: true, isActive: true,
} as const;

function toInfo(a: {
  id: string; type: PaymentAccountType; provider: string; accountNumber: string | null;
  accountName: string | null; qrisImageUrl: string | null; isActive: boolean;
}): PaymentAccountInfo {
  return {
    id: a.id, type: a.type, provider: a.provider, accountNumber: a.accountNumber,
    accountName: a.accountName, qrisImageUrl: a.qrisImageUrl, isActive: a.isActive,
  };
}

/** Hanya OWNER / ADMINISTRATOR toko yang boleh mengubah. Selalu dicek ulang di server. */
async function requireAdmin() {
  const ctx = await requireStoreAccess();
  if (!ADMIN_ROLES.includes(ctx.storeRole)) return null;
  return ctx;
}

const FORBIDDEN = 'Hanya pemilik atau administrator yang dapat mengubah informasi pembayaran.';

function refresh(storeSlug: string) {
  revalidatePath(`/${storeSlug}/admin/settings/payment`);
}

/** Hapus gambar QRIS lama dari Vercel Blob (best-effort). */
async function deleteBlobQuietly(url: string | null | undefined) {
  if (!isSafeBlobUrl(url)) return;
  try {
    await del(url);
  } catch (err) {
    console.error('[payment-accounts] gagal menghapus blob:', err);
  }
}

// ─── Baca ─────────────────────────────────────────────────────────────────────

/**
 * Akun AKTIF toko — untuk dialog pembayaran kasir dan invoice.
 * Boleh dipanggil semua staf toko (kasir, manager, admin).
 */
export async function getActivePaymentAccounts(): Promise<PaymentAccountInfo[]> {
  try {
    const { storeId } = await requireStoreAccess();
    const rows = await db.storePaymentAccount.findMany({
      where:   { storeId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select:  SELECT,
    });
    return rows.map(toInfo);
  } catch (err) {
    console.error('[payment-accounts] getActivePaymentAccounts:', err);
    return [];
  }
}

/** Semua akun (aktif & nonaktif) — untuk halaman pengaturan. Hanya admin. */
export async function getManagedPaymentAccounts(): Promise<PaymentAccountInfo[]> {
  const ctx = await requireAdmin();
  if (!ctx) return [];
  const rows = await db.storePaymentAccount.findMany({
    where:   { storeId: ctx.storeId },
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select:  SELECT,
  });
  return rows.map(toInfo);
}

// ─── Tulis ────────────────────────────────────────────────────────────────────

export async function createPaymentAccountAction(
  input: PaymentAccountInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAdmin();
  if (!ctx) return { success: false, error: FORBIDDEN };

  const check = validatePaymentAccountInput(input);
  if (!check.ok) return { success: false, error: check.error };

  const existing = await db.storePaymentAccount.count({
    where: { storeId: ctx.storeId, type: input.type },
  });
  if (existing >= MAX_ACCOUNTS_PER_TYPE[input.type]) {
    return {
      success: false,
      error: `Maksimal ${MAX_ACCOUNTS_PER_TYPE[input.type]} ${PAYMENT_ACCOUNT_TYPE_LABEL[input.type]} per toko.`,
    };
  }

  const last = await db.storePaymentAccount.findFirst({
    where:   { storeId: ctx.storeId, type: input.type },
    orderBy: { sortOrder: 'desc' },
    select:  { sortOrder: true },
  });

  const created = await db.storePaymentAccount.create({
    data: {
      storeId:       ctx.storeId,
      type:          input.type,
      provider:      check.value.provider,
      accountNumber: check.value.accountNumber,
      accountName:   check.value.accountName,
      sortOrder:     (last?.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });

  refresh(ctx.storeSlug);
  return { success: true, id: created.id };
}

export async function updatePaymentAccountAction(
  id: string,
  input: Omit<PaymentAccountInput, 'type'>
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!ctx) return { success: false, error: FORBIDDEN };

  // Selalu cari berdasarkan id + storeId milik sesi (cegah IDOR antar toko).
  const account = await db.storePaymentAccount.findFirst({
    where:  { id, storeId: ctx.storeId },
    select: { id: true, type: true },
  });
  if (!account) return { success: false, error: 'Akun pembayaran tidak ditemukan.' };

  // Tipe tidak bisa diubah setelah dibuat.
  const check = validatePaymentAccountInput({ ...input, type: account.type });
  if (!check.ok) return { success: false, error: check.error };

  await db.storePaymentAccount.update({
    where: { id: account.id },
    data: {
      provider:      check.value.provider,
      accountNumber: check.value.accountNumber,
      accountName:   check.value.accountName,
    },
  });

  refresh(ctx.storeSlug);
  return { success: true };
}

export async function setPaymentAccountActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!ctx) return { success: false, error: FORBIDDEN };

  const result = await db.storePaymentAccount.updateMany({
    where: { id, storeId: ctx.storeId },
    data:  { isActive: !!isActive },
  });
  if (result.count === 0) return { success: false, error: 'Akun pembayaran tidak ditemukan.' };

  refresh(ctx.storeSlug);
  return { success: true };
}

export async function deletePaymentAccountAction(id: string): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!ctx) return { success: false, error: FORBIDDEN };

  const account = await db.storePaymentAccount.findFirst({
    where:  { id, storeId: ctx.storeId },
    select: { id: true, qrisImageUrl: true },
  });
  if (!account) return { success: false, error: 'Akun pembayaran tidak ditemukan.' };

  await db.storePaymentAccount.delete({ where: { id: account.id } });
  await deleteBlobQuietly(account.qrisImageUrl);

  refresh(ctx.storeSlug);
  return { success: true };
}
