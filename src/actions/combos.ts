'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireStoreAccess } from '@/lib/store-context';
import { sanitizeText } from '@/lib/sanitize';
import type { ComboInfo } from '@/lib/combo-pricing';
import { comboWithSlotsInclude, toComboInfo } from '@/lib/combo-db';

// Sama seperti pengelolaan produk: admin dan manager boleh mengelola paket.
const MANAGE_ROLES = ['OWNER', 'ADMINISTRATOR', 'MANAGER'];
const MAX_PRICE    = 99_999_999;

export interface ComboInput {
  name:     string;
  price:    number;
  isActive: boolean;
  slots: Array<{
    productId:  string;
    isRequired: boolean;
    variantIds: string[];
  }>;
}

type ActionResult = { success: true; id?: string } | { success: false; error: string };

export interface AdminCombo extends ComboInfo {
  isActive: boolean;
}

export interface ComboFormProduct {
  id:       string;
  name:     string;
  variants: Array<{ id: string; name: string; price: number; isActive: boolean }>;
}

// ─── Baca ────────────────────────────────────────────────────────────────────

/** Paket aktif untuk POS (kasir/manager/admin). Hanya varian aktif yang dikirim. */
export async function getCombosForPos(): Promise<ComboInfo[]> {
  const { storeId } = await requireStoreAccess();
  const combos = await db.combo.findMany({
    where:   { storeId, isActive: true },
    orderBy: { name: 'asc' },
    include: comboWithSlotsInclude,
  });
  return combos
    .map((c) => toComboInfo(c, { activeOnly: true }))
    .filter((c) => c.slots.length > 0);
}

export async function getCombosForAdmin(): Promise<AdminCombo[]> {
  const { storeId, storeRole } = await requireStoreAccess();
  if (!MANAGE_ROLES.includes(storeRole)) return [];

  const combos = await db.combo.findMany({
    where:   { storeId },
    orderBy: { createdAt: 'desc' },
    include: comboWithSlotsInclude,
  });
  return combos.map((c) => ({ ...toComboInfo(c), isActive: c.isActive }));
}

/** Produk + varian untuk pemilih di form paket. */
export async function getComboFormProducts(): Promise<ComboFormProduct[]> {
  const { storeId, storeRole } = await requireStoreAccess();
  if (!MANAGE_ROLES.includes(storeRole)) return [];

  const products = await db.product.findMany({
    where:   { storeId, isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true,
      variants: { orderBy: { name: 'asc' }, select: { id: true, name: true, price: true, isActive: true } },
    },
  });
  return products
    .filter((p) => p.variants.length > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      variants: p.variants.map((v) => ({ id: v.id, name: v.name, price: Number(v.price), isActive: v.isActive })),
    }));
}

// ─── Validasi ────────────────────────────────────────────────────────────────

async function validateInput(
  storeId: string,
  input: ComboInput
): Promise<{ ok: true; name: string; price: number } | { ok: false; error: string }> {
  const name = sanitizeText(input.name, 80);
  if (name.length < 2) return { ok: false, error: 'Nama paket minimal 2 karakter.' };

  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE) {
    return { ok: false, error: `Harga paket harus antara 1 dan ${MAX_PRICE.toLocaleString('id-ID')}.` };
  }

  const slots = input.slots ?? [];
  if (slots.length < 1 || slots.length > 20) return { ok: false, error: 'Paket harus berisi 1 sampai 20 produk.' };

  const productIds = slots.map((s) => s.productId);
  if (new Set(productIds).size !== productIds.length) {
    return { ok: false, error: 'Satu produk hanya boleh muncul sekali dalam paket.' };
  }

  for (const s of slots) {
    if (!Array.isArray(s.variantIds) || s.variantIds.length < 1 || s.variantIds.length > 50) {
      return { ok: false, error: 'Setiap produk dalam paket harus punya minimal 1 varian.' };
    }
    if (new Set(s.variantIds).size !== s.variantIds.length) {
      return { ok: false, error: 'Varian dalam satu produk tidak boleh duplikat.' };
    }
  }

  // Semua varian harus milik toko ini DAN milik produk slot yang bersangkutan
  const allVariantIds = slots.flatMap((s) => s.variantIds);
  const variants = await db.productVariant.findMany({
    where:  { id: { in: allVariantIds }, storeId },
    select: { id: true, productId: true },
  });
  const productOf = new Map(variants.map((v) => [v.id, v.productId]));
  for (const s of slots) {
    for (const vid of s.variantIds) {
      if (productOf.get(vid) !== s.productId) return { ok: false, error: 'Ada varian yang tidak sesuai dengan produknya.' };
    }
  }

  return { ok: true, name, price };
}

function slotsCreateData(storeId: string, slots: ComboInput['slots']) {
  return slots.map((s, i) => ({
    storeId,
    productId:  s.productId,
    isRequired: !!s.isRequired,
    sortOrder:  i,
    variants: {
      create: s.variantIds.map((variantId, j) => ({ storeId, variantId, sortOrder: j })),
    },
  }));
}

function revalidateCombo(slug: string) {
  revalidatePath(`/${slug}/admin/inventory/combos`);
  revalidatePath(`/${slug}/admin`);
  revalidatePath(`/${slug}/manager`);
  revalidatePath(`/${slug}/cashier`);
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// ─── Tulis ───────────────────────────────────────────────────────────────────

export async function createComboAction(input: ComboInput): Promise<ActionResult> {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();
    if (!MANAGE_ROLES.includes(storeRole)) return { success: false, error: 'Unauthorized' };

    const v = await validateInput(storeId, input);
    if (!v.ok) return { success: false, error: v.error };

    const combo = await db.combo.create({
      data: {
        storeId,
        name:     v.name,
        price:    v.price,
        isActive: !!input.isActive,
        items:    { create: slotsCreateData(storeId, input.slots) },
      },
      select: { id: true },
    });

    revalidateCombo(storeSlug);
    return { success: true, id: combo.id };
  } catch (error) {
    if (isUniqueViolation(error)) return { success: false, error: 'Nama paket sudah dipakai.' };
    console.error('createComboAction error:', error);
    return { success: false, error: 'Gagal menyimpan paket.' };
  }
}

export async function updateComboAction(id: string, input: ComboInput): Promise<ActionResult> {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();
    if (!MANAGE_ROLES.includes(storeRole)) return { success: false, error: 'Unauthorized' };

    const existing = await db.combo.findFirst({ where: { id, storeId }, select: { id: true } });
    if (!existing) return { success: false, error: 'Paket tidak ditemukan.' };

    const v = await validateInput(storeId, input);
    if (!v.ok) return { success: false, error: v.error };

    await db.$transaction(async (tx) => {
      await tx.combo.update({
        where: { id },
        data:  { name: v.name, price: v.price, isActive: !!input.isActive },
      });
      // Ganti seluruh isi paket (varian ikut terhapus lewat cascade)
      await tx.comboItem.deleteMany({ where: { comboId: id, storeId } });
      for (const item of slotsCreateData(storeId, input.slots)) {
        await tx.comboItem.create({ data: { ...item, comboId: id } });
      }
    });

    revalidateCombo(storeSlug);
    return { success: true, id };
  } catch (error) {
    if (isUniqueViolation(error)) return { success: false, error: 'Nama paket sudah dipakai.' };
    console.error('updateComboAction error:', error);
    return { success: false, error: 'Gagal menyimpan paket.' };
  }
}

export async function toggleComboActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();
    if (!MANAGE_ROLES.includes(storeRole)) return { success: false, error: 'Unauthorized' };

    const res = await db.combo.updateMany({ where: { id, storeId }, data: { isActive } });
    if (res.count === 0) return { success: false, error: 'Paket tidak ditemukan.' };

    revalidateCombo(storeSlug);
    return { success: true, id };
  } catch (error) {
    console.error('toggleComboActiveAction error:', error);
    return { success: false, error: 'Gagal mengubah status paket.' };
  }
}

/** Riwayat penjualan tetap utuh: SaleCombo menyimpan snapshot dan comboId menjadi null. */
export async function deleteComboAction(id: string): Promise<ActionResult> {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();
    if (!MANAGE_ROLES.includes(storeRole)) return { success: false, error: 'Unauthorized' };

    const res = await db.combo.deleteMany({ where: { id, storeId } });
    if (res.count === 0) return { success: false, error: 'Paket tidak ditemukan.' };

    revalidateCombo(storeSlug);
    return { success: true };
  } catch (error) {
    console.error('deleteComboAction error:', error);
    return { success: false, error: 'Gagal menghapus paket.' };
  }
}
