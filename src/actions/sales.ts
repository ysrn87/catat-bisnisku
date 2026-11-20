'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess } from '@/lib/store-context';
import { generateSaleNumber } from '@/lib/utils';
import { getPointsConversionRate } from './settings';
import { sanitizeText } from '@/lib/sanitize';
import { generateSaleJournals } from '@/modules/accounting/lib/journal-engine';
import { resolveComboSelection, round2, type ComboResolution, type ComboSelections } from '@/lib/combo-pricing';
import { comboWithSlotsInclude, toComboInfo, type ComboWithSlots } from '@/lib/combo-db';

interface SaleItemInput {
  variantId: string;
  quantity:  number;
  price:     number;
}

type PaymentStatusValue = 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED';

interface CreateSaleInput {
  items:           SaleItemInput[];
  customerId:      string | null; // Customer.id (walk-in) atau null
  memberId?:       string | null; // StoreUser.id (member) — opsional, untuk backward compat
  paymentMethod:   string;
  paymentStatus?:  PaymentStatusValue;
  discount?:       number;
  tax?:            number;
  ongkir?:         number;
  notes?:          string;
  pointsRedeemed?: number;
  /** Paket: isi dipilih per slot; harga SELALU dihitung ulang di server. */
  packages?:       Array<{ comboId: string; selections: ComboSelections }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE SALE
// ─────────────────────────────────────────────────────────────────────────────
export async function createSaleAction(input: CreateSaleInput) {
  try {
    const { storeId, storeSlug, storeRole, userId } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR', 'MANAGER', 'CASHIER'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const {
      items: rawItems,
      packages = [],
      customerId,   // Customer.id (walk-in lokal) — nullable
      memberId,     // StoreUser.id (member) — nullable
      paymentMethod,
      paymentStatus = 'PAID',
      discount = 0, tax = 0, ongkir = 0,
      notes, pointsRedeemed = 0,
    } = input;

    const items: SaleItemInput[] = rawItems ?? [];
    if (items.length === 0 && packages.length === 0) return { success: false, error: 'Tidak ada item dalam penjualan' };
    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity <= 0)) {
      return { success: false, error: 'Kuantitas item tidak valid' };
    }

    const notesSanitized = sanitizeText(notes, 500);

    // UPDATED: cashierId → StoreStaff.id (bukan User.id langsung)
    const staffRecord = await db.storeStaff.findUnique({
      where:  { storeId_userId: { storeId, userId } },
      select: { id: true },
    });
    if (!staffRecord) return { success: false, error: 'Staff record tidak ditemukan' };
    const cashierId = staffRecord.id;

    // Resolve member StoreUser untuk poin
    let memberStoreUser: { id: string; points: number } | null = null;
    if (memberId) {
      const su = await db.storeUser.findUnique({
        where:  { id: memberId },
        select: { id: true, points: true, storeId: true },
      });
      if (!su || su.storeId !== storeId) {
        return { success: false, error: 'Member tidak valid di toko ini' };
      }
      memberStoreUser = { id: su.id, points: su.points };

      if (pointsRedeemed > 0) {
        if (pointsRedeemed > su.points) {
          return { success: false, error: `Poin tidak cukup. Tersedia: ${su.points}` };
        }
      }
    } else if (pointsRedeemed > 0) {
      return { success: false, error: 'Penukaran poin hanya untuk member' };
    }

    // ── Paket (combo): validasi pilihan & hitung harga di SERVER ───────────────
    const resolvedPackages: Array<{ combo: ComboWithSlots; res: Extract<ComboResolution, { ok: true }> }> = [];
    if (packages.length > 0) {
      if (packages.length > 50) return { success: false, error: 'Terlalu banyak paket dalam satu transaksi' };

      const comboIds = [...new Set(packages.map((p) => p.comboId))];
      const combos = await db.combo.findMany({
        where:   { id: { in: comboIds }, storeId, isActive: true },
        include: comboWithSlotsInclude,
      });
      const comboById = new Map(combos.map((c) => [c.id, c]));

      for (const pkg of packages) {
        const combo = comboById.get(pkg.comboId);
        if (!combo) return { success: false, error: 'Paket tidak ditemukan atau sudah tidak aktif' };
        const res = resolveComboSelection(toComboInfo(combo), pkg.selections ?? {});
        if (!res.ok) return { success: false, error: `${combo.name}: ${res.error}` };
        resolvedPackages.push({ combo, res });
      }
    }

    // ── Kebutuhan stok gabungan (item biasa + isi paket) ───────────────────────
    const demand = new Map<string, number>();
    for (const i of items) demand.set(i.variantId, (demand.get(i.variantId) ?? 0) + i.quantity);
    for (const p of resolvedPackages) {
      for (const l of p.res.lines) demand.set(l.variantId, (demand.get(l.variantId) ?? 0) + 1);
    }

    const variantRows = await db.productVariant.findMany({
      where:  { id: { in: [...demand.keys()] }, storeId },
      select: { id: true, name: true, stock: true, pointsPerUnit: true, type: true, cost: true },
    });
    const variantById = new Map(variantRows.map((v) => [v.id, v]));

    let pointsEarned = 0;
    for (const [variantId, qty] of demand) {
      const variant = variantById.get(variantId);
      if (!variant) return { success: false, error: 'Varian produk tidak ditemukan' };
      if (variant.type !== 'PREORDER' && variant.stock < qty) {
        return { success: false, error: `Stok tidak mencukupi untuk ${variant.name}` };
      }
      if (memberId && pointsRedeemed === 0 && paymentStatus === 'PAID') {
        pointsEarned += variant.pointsPerUnit * qty;
      }
    }

    const itemsSubtotal   = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const comboItemsTotal = round2(resolvedPackages.reduce((sum, p) => sum + p.res.itemsTotal, 0));
    const comboDiscount   = round2(resolvedPackages.reduce((sum, p) => sum + p.res.discount, 0));
    const subtotal        = round2(itemsSubtotal + comboItemsTotal);
    const conversionRate  = await getPointsConversionRate();
    const pointDiscount   = pointsRedeemed * conversionRate;
    const totalDiscount   = discount + comboDiscount + pointDiscount;

    if (totalDiscount > subtotal) return { success: false, error: 'Total diskon melebihi subtotal' };

    const total = round2(subtotal - discount - comboDiscount - pointDiscount + tax + ongkir);
    if (total < 0) return { success: false, error: 'Total pembayaran tidak boleh negatif' };

    const sale = await db.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          storeId,
          saleNumber:   generateSaleNumber(),
          cashierId:    cashierId,
          customerId:   customerId || null,
          memberId:     memberId   || null,
          subtotal, discount: round2(discount + comboDiscount), tax, ongkir, total,
          notes:        notesSanitized,
          pointsEarned: memberId && pointsRedeemed === 0 && paymentStatus === 'PAID' ? pointsEarned : 0,
          items: {
            create: items.map((i) => ({
              variantId: i.variantId,
              quantity:  i.quantity,
              price:     i.price,
              subtotal:  i.price * i.quantity,
            })),
          },
        },
        include: { items: true },
      });

      // Isi paket → SaleItem biasa (harga satuan) dikelompokkan oleh SaleCombo
      for (const p of resolvedPackages) {
        const saleCombo = await tx.saleCombo.create({
          data: {
            storeId,
            saleId:       newSale.id,
            comboId:      p.combo.id,
            name:         p.combo.name,
            packagePrice: p.res.packagePrice,
            itemsTotal:   p.res.itemsTotal,
            discount:     p.res.discount,
          },
          select: { id: true },
        });
        await tx.saleItem.createMany({
          data: p.res.lines.map((l) => ({
            saleId:      newSale.id,
            saleComboId: saleCombo.id,
            variantId:   l.variantId,
            quantity:    1,
            price:       l.price,
            subtotal:    l.price,
          })),
        });
      }

      await tx.payment.create({
        data: {
          saleId:  newSale.id,
          storeId,
          method:  paymentMethod,
          status:  paymentStatus,
          amount:  total,
          paidAt:  paymentStatus === 'PAID' ? new Date() : null,
        },
      });

      for (const [variantId, qty] of demand) {
        if (variantById.get(variantId)?.type === 'PREORDER') continue;
        const updated = await tx.productVariant.updateMany({
          where: { id: variantId, stock: { gte: qty } },
          data:  { stock: { decrement: qty } },
        });
        if (updated.count === 0) throw new Error(`Stok tidak mencukupi untuk varian ${variantId}`);
        await tx.stockMovement.create({
          data: { storeId, variantId, type: 'SALE', quantity: -qty, refSaleId: newSale.id },
        });
      }

      if (memberId && memberStoreUser) {
        if (pointsRedeemed > 0) {
          await tx.storeUser.update({
            where: { id: memberStoreUser.id },
            data:  { points: { decrement: pointsRedeemed } },
          });
          await tx.pointHistory.create({
            data: { storeUserId: memberStoreUser.id, saleId: newSale.id, type: 'REDEEM', delta: -pointsRedeemed, description: `Penukaran poin ${newSale.saleNumber}` },
          });
        } else if (pointsEarned > 0 && paymentStatus === 'PAID') {
          await tx.storeUser.update({
            where: { id: memberStoreUser.id },
            data:  { points: { increment: pointsEarned } },
          });
          await tx.pointHistory.create({
            data: { storeUserId: memberStoreUser.id, saleId: newSale.id, type: 'EARN', delta: pointsEarned, description: `Poin pembelian ${newSale.saleNumber}` },
          });
        }
      }

      await tx.cashflow.create({
        data: { storeId, saleId: newSale.id, type: 'INCOME', category: 'Penjualan', amount: total, description: `Penjualan ${newSale.saleNumber}`, occurredAt: new Date() },
      });

      return newSale;
    }, { maxWait: 10000, timeout: 20000 });

    revalidatePath(`/${storeSlug}/admin/transactions/sales`);
    revalidatePath(`/${storeSlug}/manager/transactions/sales`);
    revalidatePath(`/${storeSlug}/admin/inventory/stock`);
    revalidatePath(`/${storeSlug}/manager/inventory/stock`);
    revalidatePath(`/${storeSlug}/cashier`);

    // Generate jurnal akuntansi — non-blocking, pakai field 'cost' dari ProductVariant
    ;(async () => {
      try {
        let hppTotal = 0;
        for (const [variantId, qty] of demand) {
          hppTotal += Number(variantById.get(variantId)?.cost ?? 0) * qty;
        }

        await generateSaleJournals({
          storeId,
          saleId:        sale.id,
          total,
          hpp:           hppTotal,
          paymentMethod,
          date:          sale.createdAt,
          saleNumber:    sale.saleNumber,
        });
      } catch (err: any) {
        console.warn('Sale journal generation skipped (CoA not seeded?):', err.message);
      }
    })();

    return {
      success:       true,
      saleId:        sale.id,
      saleNumber:    sale.saleNumber,
      createdAt:     sale.createdAt,
      subtotal,
      comboDiscount,
      total,
      combos: resolvedPackages.map((p) => ({
        name:         p.combo.name,
        packagePrice: p.res.packagePrice,
        itemsTotal:   p.res.itemsTotal,
        discount:     p.res.discount,
        lines: p.res.lines.map((l) => ({
          productName: l.productName,
          variantName: l.variantName,
          price:       l.price,
          quantity:    1,
        })),
      })),
    };
  } catch (error) {
    console.error('Create sale error:', error);
    return { success: false, error: 'Gagal membuat penjualan' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE SALE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Paket pada saat edit:
 *  - { saleComboId, keep: true }  → paket yang sudah ada TIDAK diubah; dipertahankan persis
 *    (nama, harga paket, harga satuan, diskon = snapshot saat dijual).
 *  - { comboId, selections }      → paket baru atau paket yang isinya diubah. Harga & aturan
 *    dihitung ulang di SERVER dari definisi paket saat ini. Jika membawa saleComboId, paket lama
 *    itu digantikan.
 * Daftar `packages` adalah seluruh paket yang diinginkan; paket lama yang tidak disebut akan dihapus.
 */
export type UpdateSalePackageInput =
  | { saleComboId: string; keep: true }
  | { comboId: string; selections: ComboSelections; saleComboId?: string; keep?: false };

export async function updateSaleAction(
  saleId: string,
  input: {
    items:           SaleItemInput[];
    packages?:       UpdateSalePackageInput[];
    customerId?:     string | null;
    memberId?:       string | null;
    paymentMethod?:  string;
    paymentStatus?:  PaymentStatusValue;
    /** Diskon MANUAL saja. Diskon paket dihitung terpisah. */
    discount?:       number;
    tax?:            number;
    ongkir?:         number;
    notes?:          string;
    pointsRedeemed?: number;
  }
) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR', 'MANAGER'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const existingSale = await db.sale.findFirst({
      where:   { id: saleId, storeId },
      include: { items: true, payment: true, combos: true },
    });
    if (!existingSale) return { success: false, error: 'Penjualan tidak ditemukan' };

    // Sale.discount menyimpan diskon manual + diskon semua paket
    const existingPackageDiscount = existingSale.combos.reduce((sum, c) => sum + Number(c.discount), 0);

    const {
      items: rawItems,
      customerId     = existingSale.customerId,
      memberId       = existingSale.memberId,
      paymentMethod  = existingSale.payment?.method ?? 'CASH',
      paymentStatus  = (existingSale.payment?.status as PaymentStatusValue) ?? 'PAID',
      discount       = Math.max(0, Number(existingSale.discount) - existingPackageDiscount),
      tax            = Number(existingSale.tax),
      ongkir         = Number(existingSale.ongkir),
      notes,
      pointsRedeemed = 0,
    } = input;

    // `packages` tidak dikirim → semua paket yang ada dipertahankan (tidak terhapus diam-diam).
    // Dikirim (termasuk array kosong) → daftar itu otoritatif.
    const packages: UpdateSalePackageInput[] =
      input.packages ?? existingSale.combos.map((c) => ({ saleComboId: c.id, keep: true as const }));

    const items: SaleItemInput[] = rawItems ?? [];
    if (items.length === 0 && packages.length === 0) return { success: false, error: 'Tidak ada item dalam penjualan' };
    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity <= 0)) {
      return { success: false, error: 'Kuantitas item tidak valid' };
    }
    if (packages.length > 50) return { success: false, error: 'Terlalu banyak paket dalam satu transaksi' };

    // ── Paket: pertahankan yang tidak diubah, hitung ulang yang baru/diubah ────
    const existingComboById = new Map(existingSale.combos.map((c) => [c.id, c]));
    const keptIds = new Set<string>();
    const kept: Array<{ id: string; itemsTotal: number; discount: number; lines: Array<{ variantId: string; quantity: number }> }> = [];
    const fresh: Array<{ combo: ComboWithSlots; res: Extract<ComboResolution, { ok: true }> }> = [];

    const resolveInputs = packages.flatMap((p) => (p.keep === true ? [] : 'comboId' in p ? [p] : []));
    const comboById = new Map<string, ComboWithSlots>();
    if (resolveInputs.length > 0) {
      const combos = await db.combo.findMany({
        where:   { id: { in: [...new Set(resolveInputs.map((p) => p.comboId))] }, storeId, isActive: true },
        include: comboWithSlotsInclude,
      });
      combos.forEach((c) => comboById.set(c.id, c));
    }

    for (const p of packages) {
      if (p.keep === true) {
        const c = existingComboById.get(p.saleComboId);
        if (!c || keptIds.has(c.id)) return { success: false, error: 'Paket pada transaksi tidak valid' };
        keptIds.add(c.id);
        kept.push({
          id:         c.id,
          itemsTotal: Number(c.itemsTotal),
          discount:   Number(c.discount),
          lines:      existingSale.items.filter((i) => i.saleComboId === c.id).map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        });
      } else {
        if (!('comboId' in p)) return { success: false, error: 'Paket tidak valid' };
        const combo = comboById.get(p.comboId);
        if (!combo) return { success: false, error: 'Paket tidak ditemukan atau sudah tidak aktif' };
        const res = resolveComboSelection(toComboInfo(combo), p.selections ?? {});
        if (!res.ok) return { success: false, error: `${combo.name}: ${res.error}` };
        fresh.push({ combo, res });
      }
    }

    // ── Kebutuhan stok gabungan: item biasa + paket dipertahankan + paket baru ──
    const demand = new Map<string, number>();
    const addDemand = (variantId: string, qty: number) => demand.set(variantId, (demand.get(variantId) ?? 0) + qty);
    items.forEach((i) => addDemand(i.variantId, i.quantity));
    kept.forEach((k) => k.lines.forEach((l) => addDemand(l.variantId, l.quantity)));
    fresh.forEach((f) => f.res.lines.forEach((l) => addDemand(l.variantId, 1)));

    const itemsSubtotal      = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const packagesItemsTotal = round2(kept.reduce((s, k) => s + k.itemsTotal, 0) + fresh.reduce((s, f) => s + f.res.itemsTotal, 0));
    const packagesDiscount   = round2(kept.reduce((s, k) => s + k.discount, 0) + fresh.reduce((s, f) => s + f.res.discount, 0));
    const subtotal           = round2(itemsSubtotal + packagesItemsTotal);
    const conversionRate     = await getPointsConversionRate();
    const pointDiscount      = pointsRedeemed * conversionRate;
    const total              = round2(subtotal - discount - packagesDiscount - pointDiscount + tax + ongkir);
    if (total < 0) return { success: false, error: 'Total pembayaran tidak boleh negatif' };

    const oldVariantIds = [...new Set(existingSale.items.map((i) => i.variantId))];
    const oldVariants = await db.productVariant.findMany({
      where:  { id: { in: oldVariantIds } },
      select: { id: true, type: true },
    });
    const oldVariantTypeById = new Map(oldVariants.map((v) => [v.id, v.type]));

    const oldQtyByVariant = new Map<string, number>();
    for (const oldItem of existingSale.items) {
      oldQtyByVariant.set(oldItem.variantId, (oldQtyByVariant.get(oldItem.variantId) ?? 0) + oldItem.quantity);
    }
    const newVariants = await db.productVariant.findMany({
      where:  { id: { in: [...demand.keys()] }, storeId },
      select: { id: true, stock: true, type: true, name: true },
    });
    const newVariantById = new Map(newVariants.map((v) => [v.id, v]));

    for (const [variantId, qty] of demand) {
      const variant = newVariantById.get(variantId);
      if (!variant) return { success: false, error: 'Varian tidak ditemukan' };
      if (variant.type !== 'PREORDER') {
        // stok lama dikembalikan dulu (semua item transaksi ini), baru dikurangi sesuai kebutuhan baru
        const effectiveStock = variant.stock + (oldQtyByVariant.get(variantId) ?? 0);
        if (effectiveStock < qty) return { success: false, error: `Stok tidak mencukupi untuk ${variant.name}` };
      }
    }

    await db.$transaction(async (tx) => {
      for (const oldItem of existingSale.items) {
        if (oldVariantTypeById.get(oldItem.variantId) === 'PREORDER') continue;
        await tx.productVariant.update({
          where: { id: oldItem.variantId },
          data:  { stock: { increment: oldItem.quantity } },
        });
      }

      for (const [variantId, qty] of demand) {
        const variant = newVariantById.get(variantId)!;
        if (variant.type !== 'PREORDER') {
          const updated = await tx.productVariant.updateMany({
            where: { id: variantId, stock: { gte: qty } },
            data:  { stock: { decrement: qty } },
          });
          if (updated.count === 0) throw new Error(`Stok tidak mencukupi untuk ${variant.name}`);
        }
      }

      // Hapus item & paket lama KECUALI paket yang dipertahankan (barisnya tetap utuh)
      const keptList = [...keptIds];
      await tx.saleItem.deleteMany({
        where: { saleId, OR: [{ saleComboId: null }, { saleComboId: { notIn: keptList } }] },
      });
      await tx.saleCombo.deleteMany({ where: { saleId, id: { notIn: keptList } } });

      if (items.length > 0) {
        await tx.saleItem.createMany({
          data: items.map((i) => ({
            saleId,
            variantId: i.variantId,
            quantity:  i.quantity,
            price:     i.price,
            subtotal:  i.price * i.quantity,
          })),
        });
      }

      for (const f of fresh) {
        const saleCombo = await tx.saleCombo.create({
          data: {
            storeId,
            saleId,
            comboId:      f.combo.id,
            name:         f.combo.name,
            packagePrice: f.res.packagePrice,
            itemsTotal:   f.res.itemsTotal,
            discount:     f.res.discount,
          },
          select: { id: true },
        });
        await tx.saleItem.createMany({
          data: f.res.lines.map((l) => ({
            saleId,
            saleComboId: saleCombo.id,
            variantId:   l.variantId,
            quantity:    1,
            price:       l.price,
            subtotal:    l.price,
          })),
        });
      }

      await tx.sale.update({
        where: { id: saleId },
        data: {
          customerId,
          memberId,
          subtotal,
          discount: round2(discount + packagesDiscount),
          tax, ongkir, total,
          notes: notes !== undefined ? sanitizeText(notes, 500) : existingSale.notes,
        },
      });

      if (existingSale.payment) {
        await tx.payment.update({
          where: { saleId },
          data: {
            method: paymentMethod,
            status: paymentStatus,
            amount: total,
            paidAt: paymentStatus === 'PAID' ? (existingSale.payment.paidAt ?? new Date()) : null,
          },
        });
      }

      const existingCashflow = await tx.cashflow.findUnique({ where: { saleId } });
      if (existingCashflow) {
        await tx.cashflow.update({ where: { saleId }, data: { amount: total } });
      }
    }, { maxWait: 10000, timeout: 15000 });

    revalidatePath(`/${storeSlug}/admin/transactions/sales`);
    revalidatePath(`/${storeSlug}/manager/transactions/sales`);
    revalidatePath(`/${storeSlug}/admin/inventory/stock`);
    return { success: true };
  } catch (error) {
    console.error('Update sale error:', error);
    return { success: false, error: (error as Error).message || 'Gagal mengupdate penjualan' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET SALES
// ─────────────────────────────────────────────────────────────────────────────
export async function getSales(limit = 50) {
  const { storeId } = await requireStoreAccess();
  return db.sale.findMany({
    where:   { storeId },
    take:    limit,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { name: true } },
      member:   { select: { user: { select: { name: true, email: true } } } },
      payment:  { select: { method: true, status: true } },
      items:    { include: { variant: { include: { product: true } } } },
      combos:   true,
    },
  });
}

export async function getSaleById(id: string) {
  const { storeId } = await requireStoreAccess();
  return db.sale.findFirst({
    where:   { id, storeId },
    include: {
      customer: true,
      member:   { include: { user: true } },
      cashier:  { include: { user: { select: { name: true, email: true } } } },
      payment:  true,
      items:    { include: { variant: { include: { product: true } } } },
      combos:   true,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE SALE
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteSaleAction(id: string) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR', 'MANAGER'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const sale = await db.sale.findFirst({
      where:   { id, storeId },
      include: { items: true },
    });
    if (!sale) return { success: false, error: 'Penjualan tidak ditemukan' };

    await db.$transaction(async (tx) => {
      for (const item of sale.items) {
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { type: true } });
        if (variant?.type === 'PREORDER') continue;
        await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
        await tx.stockMovement.create({
          data: { storeId, variantId: item.variantId, type: 'RETURN', quantity: item.quantity, notes: `Stok kembali dari penghapusan ${sale.saleNumber}`, refSaleId: sale.id },
        });
      }

      // Batalkan poin untuk member
      if (sale.memberId && sale.pointsEarned > 0) {
        const storeUser = await tx.storeUser.findUnique({
          where:  { id: sale.memberId },
          select: { id: true, points: true },
        });
        if (storeUser) {
          const deduct = Math.min(sale.pointsEarned, storeUser.points);
          if (deduct > 0) {
            await tx.storeUser.update({ where: { id: storeUser.id }, data: { points: { decrement: deduct } } });
            await tx.pointHistory.create({
              data: { storeUserId: storeUser.id, saleId: sale.id, type: 'ADJUST', delta: -deduct, description: `Poin dibatalkan dari penghapusan ${sale.saleNumber}` },
            });
          }
        }
      }

      await tx.sale.delete({ where: { id, storeId } });
    });

    revalidatePath(`/${storeSlug}/admin/transactions/sales`);
    revalidatePath(`/${storeSlug}/manager/transactions/sales`);
    revalidatePath(`/${storeSlug}/admin/inventory/stock`);
    revalidatePath(`/${storeSlug}/admin/finance/cashflow`);
    return { success: true };
  } catch (error) {
    console.error('Delete sale error:', error);
    return { success: false, error: 'Gagal menghapus penjualan' };
  }
}
