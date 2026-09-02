'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess } from '@/lib/store-context';
import { generateSaleNumber } from '@/lib/utils';
import { getPointsConversionRate } from './settings';
import { sanitizeText } from '@/lib/sanitize';
import { generateSaleJournals } from '@/modules/accounting/lib/journal-engine';

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
      items,
      customerId,   // Customer.id (walk-in lokal) — nullable
      memberId,     // StoreUser.id (member) — nullable
      paymentMethod,
      paymentStatus = 'PAID',
      discount = 0, tax = 0, ongkir = 0,
      notes, pointsRedeemed = 0,
    } = input;

    if (!items?.length) return { success: false, error: 'Tidak ada item dalam penjualan' };

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

    let pointsEarned = 0;
    const variantTypeById = new Map<string, string>();

    for (const item of items) {
      const variant = await db.productVariant.findFirst({
        where:  { id: item.variantId, storeId },
        select: { id: true, name: true, stock: true, pointsPerUnit: true, type: true },
      });

      if (!variant) return { success: false, error: 'Varian produk tidak ditemukan' };
      if (variant.type !== 'PREORDER' && variant.stock < item.quantity) {
        return { success: false, error: `Stok tidak mencukupi untuk ${variant.name}` };
      }

      variantTypeById.set(variant.id, variant.type);

      if (memberId && pointsRedeemed === 0 && paymentStatus === 'PAID') {
        pointsEarned += variant.pointsPerUnit * item.quantity;
      }
    }

    const subtotal       = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const conversionRate = await getPointsConversionRate();
    const pointDiscount  = pointsRedeemed * conversionRate;
    const totalDiscount  = discount + pointDiscount;

    if (totalDiscount > subtotal) return { success: false, error: 'Total diskon melebihi subtotal' };

    const total = subtotal - discount - pointDiscount + tax + ongkir;
    if (total < 0) return { success: false, error: 'Total pembayaran tidak boleh negatif' };

    const sale = await db.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          storeId,
          saleNumber:   generateSaleNumber(),
          cashierId:    cashierId,
          customerId:   customerId || null,
          memberId:     memberId   || null,
          subtotal, discount, tax, ongkir, total,
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

      for (const item of items) {
        if (variantTypeById.get(item.variantId) === 'PREORDER') continue;
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data:  { stock: { decrement: item.quantity } },
        });
        if (updated.count === 0) throw new Error(`Stok tidak mencukupi untuk varian ${item.variantId}`);
        await tx.stockMovement.create({
          data: { storeId, variantId: item.variantId, type: 'SALE', quantity: -item.quantity, refSaleId: newSale.id },
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
        const variants = await db.productVariant.findMany({
          where:  { id: { in: items.map((i) => i.variantId) } },
          select: { id: true, cost: true },
        });
        const costMap  = new Map(variants.map((v) => [v.id, Number(v.cost ?? 0)]));
        const hppTotal = items.reduce((sum, i) => sum + (costMap.get(i.variantId) ?? 0) * i.quantity, 0);

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

    return { success: true, saleId: sale.id, saleNumber: sale.saleNumber, createdAt: sale.createdAt };
  } catch (error) {
    console.error('Create sale error:', error);
    return { success: false, error: 'Gagal membuat penjualan' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE SALE
// ─────────────────────────────────────────────────────────────────────────────
export async function updateSaleAction(
  saleId: string,
  input: {
    items:           SaleItemInput[];
    customerId?:     string | null;
    memberId?:       string | null;
    paymentMethod?:  string;
    paymentStatus?:  PaymentStatusValue;
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
      include: { items: true, payment: true },
    });
    if (!existingSale) return { success: false, error: 'Penjualan tidak ditemukan' };

    const {
      items,
      customerId     = existingSale.customerId,
      memberId       = existingSale.memberId,
      paymentMethod  = existingSale.payment?.method ?? 'CASH',
      paymentStatus  = (existingSale.payment?.status as PaymentStatusValue) ?? 'PAID',
      discount       = Number(existingSale.discount),
      tax            = Number(existingSale.tax),
      ongkir         = Number(existingSale.ongkir),
      notes,
      pointsRedeemed = 0,
    } = input;

    if (!items?.length) return { success: false, error: 'Tidak ada item dalam penjualan' };

    const subtotal       = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const conversionRate = await getPointsConversionRate();
    const pointDiscount  = pointsRedeemed * conversionRate;
    const total          = subtotal - discount - pointDiscount + tax + ongkir;
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
    const newVariantIds = [...new Set(items.map((i) => i.variantId))];
    const newVariants = await db.productVariant.findMany({
      where:  { id: { in: newVariantIds }, storeId },
      select: { id: true, stock: true, type: true, name: true },
    });
    const newVariantById = new Map(newVariants.map((v) => [v.id, v]));

    for (const item of items) {
      const variant = newVariantById.get(item.variantId);
      if (!variant) return { success: false, error: 'Varian tidak ditemukan' };
      if (variant.type !== 'PREORDER') {
        const effectiveStock = variant.stock + (oldQtyByVariant.get(item.variantId) ?? 0);
        if (effectiveStock < item.quantity) {
          return { success: false, error: `Stok tidak mencukupi untuk ${variant.name}` };
        }
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

      for (const item of items) {
        const variant = newVariantById.get(item.variantId)!;
        if (variant.type !== 'PREORDER') {
          const updated = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data:  { stock: { decrement: item.quantity } },
          });
          if (updated.count === 0) throw new Error(`Stok tidak mencukupi untuk ${variant.name}`);
        }
      }

      await tx.sale.update({
        where: { id: saleId },
        data: {
          customerId,
          memberId,
          subtotal, discount, tax, ongkir, total,
          notes: notes !== undefined ? sanitizeText(notes, 500) : existingSale.notes,
          items: {
            deleteMany: {},
            create: items.map((i) => ({
              variantId: i.variantId,
              quantity:  i.quantity,
              price:     i.price,
              subtotal:  i.price * i.quantity,
            })),
          },
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
