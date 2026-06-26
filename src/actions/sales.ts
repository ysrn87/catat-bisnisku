'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess } from '@/lib/store-context';
import { generateSaleNumber } from '@/lib/utils';
import { getPointsConversionRate } from './settings';
import { sanitizeText } from '@/lib/sanitize';

interface SaleItemInput {
  variantId: string;
  quantity:  number;
  price:     number;
}

type PaymentStatusValue = 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED';

interface CreateSaleInput {
  items:           SaleItemInput[];
  customerId:      string | null;
  paymentMethod:   string;
  paymentStatus?:  PaymentStatusValue;
  discount?:       number;
  tax?:            number;
  ongkir?:         number;
  notes?:          string;
  pointsRedeemed?: number;
}

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────
async function getStoreUserId(storeId: string, userId: string): Promise<string | null> {
  const su = await db.storeUser.findUnique({
    where:  { storeId_userId: { storeId, userId } },
    select: { id: true },
  });
  return su?.id ?? null;
}

// ─────────────────────────────────────────────────────────────
// CREATE SALE
// ─────────────────────────────────────────────────────────────
export async function createSaleAction(input: CreateSaleInput) {
  try {
    const { storeId, storeSlug, storeRole, userId } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR', 'MANAGER', 'CASHIER'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    const {
      items, customerId,
      paymentMethod, paymentStatus = 'PAID',
      discount = 0, tax = 0, ongkir = 0,
      notes, pointsRedeemed = 0,
    } = input;

    if (!items?.length) return { success: false, error: 'Tidak ada item dalam penjualan' };

    const notesSanitized = sanitizeText(notes, 500);

    let customerStoreUserId: string | null = null;
    if (customerId) {
      const storeUser = await db.storeUser.findUnique({
        where:  { storeId_userId: { storeId, userId: customerId } },
        select: { id: true, role: true, points: true },
      });
      customerStoreUserId = storeUser?.id ?? null;

      if (pointsRedeemed > 0) {
        if (!storeUser || storeUser.role !== 'MEMBER') {
          return { success: false, error: 'Penukaran poin hanya untuk member' };
        }
        if (pointsRedeemed > storeUser.points) {
          return { success: false, error: `Poin tidak cukup. Tersedia: ${storeUser.points}` };
        }
      }
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

      if (customerId && pointsRedeemed === 0 && paymentStatus === 'PAID') {
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
          cashierId:    userId,
          customerId,
          subtotal, discount, tax, ongkir, total,
          notes:        notesSanitized,
          pointsEarned: customerId && pointsRedeemed === 0 && paymentStatus === 'PAID' ? pointsEarned : 0,
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

      if (customerId && customerStoreUserId) {
        if (pointsRedeemed > 0) {
          await tx.storeUser.update({
            where: { storeId_userId: { storeId, userId: customerId } },
            data:  { points: { decrement: pointsRedeemed } },
          });
          await tx.pointHistory.create({
            data: { storeUserId: customerStoreUserId, saleId: newSale.id, type: 'REDEEM', delta: -pointsRedeemed, description: `Penukaran poin ${newSale.saleNumber}` },
          });
        } else if (pointsEarned > 0 && paymentStatus === 'PAID') {
          await tx.storeUser.update({
            where: { storeId_userId: { storeId, userId: customerId } },
            data:  { points: { increment: pointsEarned } },
          });
          await tx.pointHistory.create({
            data: { storeUserId: customerStoreUserId, saleId: newSale.id, type: 'EARN', delta: pointsEarned, description: `Poin pembelian ${newSale.saleNumber}` },
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
    return { success: true, saleId: sale.id, saleNumber: sale.saleNumber, createdAt: sale.createdAt };
  } catch (error) {
    console.error('Create sale error:', error);
    return { success: false, error: 'Gagal membuat penjualan' };
  }
}

// ─────────────────────────────────────────────────────────────
// UPDATE SALE
// Dipanggil dari edit-sale-dialog — update items, payment, discount, notes
// ─────────────────────────────────────────────────────────────
export async function updateSaleAction(
  saleId: string,
  input: {
    items:           SaleItemInput[];
    customerId?:     string | null;
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
      paymentMethod  = existingSale.payment?.method ?? 'CASH',
      paymentStatus  = (existingSale.payment?.status as PaymentStatusValue) ?? 'PAID',
      discount       = Number(existingSale.discount),
      tax            = Number(existingSale.tax),
      ongkir         = Number(existingSale.ongkir),
      notes,
      pointsRedeemed = 0,
    } = input;

    if (!items?.length) return { success: false, error: 'Tidak ada item dalam penjualan' };

    // Hitung total baru
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const conversionRate = await getPointsConversionRate();
    const pointDiscount  = pointsRedeemed * conversionRate;
    const total          = subtotal - discount - pointDiscount + tax + ongkir;
    if (total < 0) return { success: false, error: 'Total pembayaran tidak boleh negatif' };

    // ── Pra-validasi di luar transaksi (read-only, tidak perlu lock) ──
    // Tipe varian untuk items lama (untuk skip PREORDER saat restore stok)
    const oldVariantIds = [...new Set(existingSale.items.map((i) => i.variantId))];
    const oldVariants = await db.productVariant.findMany({
      where:  { id: { in: oldVariantIds } },
      select: { id: true, type: true },
    });
    const oldVariantTypeById = new Map(oldVariants.map((v) => [v.id, v.type]));

    // Validasi stok untuk items baru. Stok lama belum dikembalikan di titik ini,
    // jadi stok efektif yang tersedia = stock + qty lama (kalau varian yang sama dipakai lagi)
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
      // 1. Kembalikan stok dari items lama
      for (const oldItem of existingSale.items) {
        if (oldVariantTypeById.get(oldItem.variantId) === 'PREORDER') continue;
        await tx.productVariant.update({
          where: { id: oldItem.variantId },
          data:  { stock: { increment: oldItem.quantity } },
        });
      }

      // 2. Kurangi stok dari items baru
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

      // 3. Update Sale
      await tx.sale.update({
        where: { id: saleId },
        data: {
          customerId,
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

      // 4. Update Payment
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

      // 5. Update Cashflow
      const existingCashflow = await tx.cashflow.findUnique({ where: { saleId } });
      if (existingCashflow) {
        await tx.cashflow.update({
          where: { saleId },
          data:  { amount: total },
        });
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

// ─────────────────────────────────────────────────────────────
// GET SALES
// Catatan: payment dikembalikan nested (sale.payment.method / .status),
// BUKAN flat sale.paymentMethod / sale.paymentStatus. Komponen seperti
// SalesTable & SaleDetailsDialog mengharapkan field flat — kalau dipakai
// untuk itu, flatten dulu (lihat getSales() di page.tsx admin/manager/cashier
// transactions/sales untuk contoh polanya).
// ─────────────────────────────────────────────────────────────
export async function getSales(limit = 50) {
  const { storeId } = await requireStoreAccess();
  return db.sale.findMany({
    where:   { storeId },
    take:    limit,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { name: true, email: true } },
      payment:  { select: { method: true, status: true } },
      items:    { include: { variant: { include: { product: true } } } },
    },
  });
}

// Catatan: sama seperti getSales() di atas — payment nested, bukan flat.
export async function getSaleById(id: string) {
  const { storeId } = await requireStoreAccess();
  return db.sale.findFirst({
    where:   { id, storeId },
    include: {
      customer: true,
      cashier:  { select: { name: true, email: true } },
      payment:  true,
      items:    { include: { variant: { include: { product: true } } } },
    },
  });
}

// ─────────────────────────────────────────────────────────────
// DELETE SALE
// ─────────────────────────────────────────────────────────────
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

      if (sale.customerId && sale.pointsEarned > 0) {
        const storeUser = await tx.storeUser.findUnique({
          where:  { storeId_userId: { storeId, userId: sale.customerId } },
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

      await tx.sale.delete({ where: { id } });
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
