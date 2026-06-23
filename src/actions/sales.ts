'use server';

import { db } from '@/lib/db';
import { PaymentStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess } from '@/lib/store-context';
import { generateSaleNumber } from '@/lib/utils';
import { getPointsExpiryDate } from '@/lib/points-utils';
import { getPointsConversionRate } from './settings';
import { sanitizeText } from '@/lib/sanitize';

interface SaleItemInput {
  variantId: string;
  quantity: number;
  price: number;
}

interface CreateSaleInput {
  items: SaleItemInput[];
  customerId: string | null;
  paymentMethod: string;
  paymentStatus?: PaymentStatus;
  discount?: number;
  tax?: number;
  ongkir?: number;
  notes?: string;
  pointsRedeemed?: number;
}

export async function createSaleAction(input: CreateSaleInput) {
  try {
    const { storeId, storeSlug, storeRole, userId } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER' && storeRole !== 'CASHIER') {
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
    if (notesSanitized.length > 500) return { success: false, error: 'Catatan maksimal 500 karakter' };

    // Points can only be redeemed by MEMBER customers (not CUSTOMER)
    if (pointsRedeemed > 0 && customerId) {
      const storeUser = await db.storeUser.findUnique({
        where: { storeId_userId: { storeId, userId: customerId } },
        select: { role: true, points: true },
      });
      if (!storeUser || storeUser.role !== 'MEMBER') {
        return { success: false, error: 'Penukaran poin hanya untuk member' };
      }
      if (pointsRedeemed > storeUser.points) {
        return { success: false, error: `Poin tidak cukup. Tersedia: ${storeUser.points}` };
      }
    }

    let pointsEarned = 0;
    const variantTypeById = new Map<string, string>();
    for (const item of items) {
      const variant = await db.productVariant.findFirst({
        where: { id: item.variantId, storeId },
        select: { id: true, name: true, stock: true, points: true, type: true },
      });

      if (!variant) return { success: false, error: 'Varian produk tidak ditemukan' };
      if (variant.type !== 'PREORDER' && variant.stock < item.quantity) {
        return { success: false, error: `Stok tidak mencukupi untuk ${variant.name}` };
      }

      variantTypeById.set(variant.id, variant.type);

      if (customerId && pointsRedeemed === 0 && paymentStatus === 'PAID') {
        pointsEarned += variant.points * item.quantity;
      }
    }

    const subtotal      = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const conversionRate = await getPointsConversionRate();
    const pointDiscount  = pointsRedeemed * conversionRate;
    const totalDiscount  = discount + pointDiscount;

    if (totalDiscount > subtotal) {
      return { success: false, error: `Total diskon (Rp ${totalDiscount.toLocaleString('id-ID')}) melebihi subtotal` };
    }

    const total = subtotal - discount - pointDiscount + tax + ongkir;
    if (total < 0) return { success: false, error: 'Total pembayaran tidak boleh negatif' };

    const sale = await db.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          storeId,
          saleNumber: generateSaleNumber(),
          cashierId: userId,
          customerId,
          subtotal, discount, tax, ongkir, total,
          paymentMethod,
          paymentStatus: paymentStatus as PaymentStatus,
          notes: notesSanitized,
          pointsEarned:  customerId && pointsRedeemed === 0 && paymentStatus === 'PAID' ? pointsEarned : 0,
          pointsRedeemed: customerId ? pointsRedeemed : 0,
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

      const stockMovements: { storeId: string; variantId: string; quantity: number; type: string; notes: string }[] = [];

      for (const item of items) {
        const type = variantTypeById.get(item.variantId);
        if (type === 'PREORDER') continue;

        // Atomic check+decrement — cegah race condition (TOCTOU)
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data:  { stock: { decrement: item.quantity } },
        });
        if (updated.count === 0) {
          throw new Error(`Stok tidak mencukupi untuk varian ${item.variantId}`);
        }
        stockMovements.push({
          storeId, variantId: item.variantId, quantity: -item.quantity, type: 'OUT',
          notes: `PENJUALAN ${newSale.saleNumber}`,
        });
      }

      if (stockMovements.length > 0) {
        await tx.stockMovement.createMany({ data: stockMovements });
      }

      if (customerId) {
        if (pointsRedeemed > 0) {
          await tx.storeUser.update({ where: { storeId_userId: { storeId, userId: customerId } }, data: { points: { decrement: pointsRedeemed } } });
          await tx.pointHistory.create({ data: { userId: customerId, storeId, points: -pointsRedeemed, type: 'REDEEMED', description: `Penukaran poin ${newSale.saleNumber}` } });
        } else if (pointsEarned > 0) {
          await tx.storeUser.update({ where: { storeId_userId: { storeId, userId: customerId } }, data: { points: { increment: pointsEarned } } });
          await tx.pointHistory.create({ data: { userId: customerId, storeId, points: pointsEarned, type: 'EARNED', description: `Poin pembelian ${newSale.saleNumber}`, expiresAt: getPointsExpiryDate() } });
        }
      }

      await tx.cashflow.create({
        data: {
          storeId,
          type: 'INCOME',
          category: 'Penjualan',
          amount: total,
          description: `Sale ${newSale.saleNumber}`,
          date: new Date(),
          saleId: newSale.id,
          createdById: userId,
        },
      });

      return newSale;
    }, {
      maxWait: 10000, // waktu tunggu maksimal untuk dapat koneksi dari pool
      timeout:  20000, // waktu maksimal transaksi berjalan — beri ruang untuk DB remote/lambat
    });

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

export async function getSales(limit = 50) {
  const { storeId } = await requireStoreAccess();
  return db.sale.findMany({
    where: { storeId },
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { name: true, email: true } },
      items: { include: { variant: { include: { product: true } } } },
    },
  });
}

export async function getSaleById(id: string) {
  const { storeId } = await requireStoreAccess();
  return db.sale.findFirst({
    where: { id, storeId },
    include: {
      customer: true,
      cashier: { select: { name: true, email: true } },
      items: { include: { variant: { include: { product: true } } } },
    },
  });
}

export async function updateSaleAction(id: string, input: CreateSaleInput) {
  try {
    const { storeId, storeSlug, storeRole, userId } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER' && storeRole !== 'CASHIER') {
      return { success: false, error: 'Unauthorized' };
    }

    const {
      items, customerId, paymentMethod, paymentStatus = 'PAID',
      discount = 0, tax = 0, ongkir = 0, notes, pointsRedeemed = 0,
    } = input;

    if (!items?.length) return { success: false, error: 'Tidak ada item dalam penjualan' };
    const notesSanitized = sanitizeText(notes, 500);
    if (notesSanitized.length > 500) return { success: false, error: 'Catatan maksimal 500 karakter' };

    const originalSale = await db.sale.findFirst({ where: { id, storeId }, include: { items: true } });
    if (!originalSale) return { success: false, error: 'Penjualan tidak ditemukan' };

    // Cashier hanya boleh mengedit transaksi yang dia buat sendiri
    if (storeRole === 'CASHIER' && originalSale.cashierId !== userId) {
      return { success: false, error: 'Anda hanya bisa mengedit transaksi milik sendiri' };
    }

    let pointsEarned = 0;
    const shouldEarnPoints = Number(originalSale.pointsRedeemed) === 0 && paymentStatus === 'PAID';

    for (const item of items) {
      const variant = await db.productVariant.findFirst({
        where: { id: item.variantId, storeId },
        select: { id: true, name: true, stock: true, points: true, type: true },
      });
      if (!variant) return { success: false, error: 'Varian produk tidak ditemukan' };

      const originalQty = originalSale.items.find((i) => i.variantId === item.variantId)?.quantity ?? 0;
      const diff = item.quantity - originalQty;

      if (variant.type !== 'PREORDER' && diff > 0 && variant.stock < diff) {
        return { success: false, error: `Stok tidak mencukupi untuk ${variant.name}` };
      }

      if (shouldEarnPoints) pointsEarned += variant.points * item.quantity;
    }

    const subtotal       = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const conversionRate = await getPointsConversionRate();
    const pointDiscount  = pointsRedeemed * conversionRate;
    const total          = subtotal - discount - pointDiscount + tax + ongkir;

    await db.$transaction(async (tx) => {
      // Kembalikan stok dari penjualan asli
      for (const item of originalSale.items) {
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { id: true, name: true, stock: true, points: true, type: true } });
        if (variant?.type === 'PREORDER') continue;
        await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
        await tx.stockMovement.create({ data: { storeId, variantId: item.variantId, quantity: item.quantity, type: 'IN', notes: `Reversed from edited sale ${originalSale.saleNumber}` } });
      }

      await tx.saleItem.deleteMany({ where: { saleId: id } });

      await tx.sale.update({
        where: { id },
        data: {
          customerId, subtotal, discount, tax, ongkir, total,
          paymentMethod, paymentStatus: paymentStatus as PaymentStatus, notes: notesSanitized,
          pointsEarned:  customerId && paymentStatus === 'PAID' ? pointsEarned : 0,
          pointsRedeemed,
          items: { create: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, price: i.price, subtotal: i.price * i.quantity })) },
        },
      });

      for (const item of items) {
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { id: true, name: true, stock: true, points: true, type: true } });
        if (variant?.type === 'PREORDER') continue;
        // Atomic check+decrement — cegah race condition (TOCTOU)
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data:  { stock: { decrement: item.quantity } },
        });
        if (updated.count === 0) {
          throw new Error(`Stok tidak mencukupi untuk varian ${item.variantId}`);
        }
        await tx.stockMovement.create({ data: { storeId, variantId: item.variantId, quantity: -item.quantity, type: 'OUT', notes: `Updated sale ${originalSale.saleNumber}` } });
      }

      if (originalSale.customerId && originalSale.customerId === customerId) {
        const diff = pointsEarned - Number(originalSale.pointsEarned);
        if (diff !== 0) {
          await tx.storeUser.update({ where: { storeId_userId: { storeId, userId: customerId! } }, data: { points: { increment: diff } } });
          await tx.pointHistory.create({ data: { userId: customerId!, storeId, points: diff, type: diff > 0 ? 'EARNED' : 'ADJUSTED', description: `Penyesuaian pembelian ${originalSale.saleNumber}` } });
        }
      } else {
        if (originalSale.customerId) {
          await tx.storeUser.update({ where: { storeId_userId: { storeId, userId: originalSale.customerId } }, data: { points: { decrement: Number(originalSale.pointsEarned) } } });
          await tx.pointHistory.create({ data: { userId: originalSale.customerId, storeId, points: -Number(originalSale.pointsEarned), type: 'ADJUSTED', description: `Removed from edited sale ${originalSale.saleNumber}` } });
        }
        if (customerId && pointsEarned > 0) {
          await tx.storeUser.update({ where: { storeId_userId: { storeId, userId: customerId } }, data: { points: { increment: pointsEarned } } });
          await tx.pointHistory.create({ data: { userId: customerId, storeId, points: pointsEarned, type: 'EARNED', description: `Didapat dari perubahan pembelian ${originalSale.saleNumber}` } });
        }
      }

      const cashflowDiff = total - Number(originalSale.total);
      if (cashflowDiff !== 0) {
        await tx.cashflow.create({
          data: {
            storeId,
            type: cashflowDiff > 0 ? 'INCOME' : 'EXPENSE',
            category: 'Penyesuaian Penjualan',
            amount: Math.abs(cashflowDiff),
            description: `Transaksi ${originalSale.saleNumber}`,
            date: new Date(),
            saleId: id,
            createdById: userId,
          },
        });
      }
    });

    revalidatePath(`/${storeSlug}/admin/transactions/sales`);
    revalidatePath(`/${storeSlug}/manager/transactions/sales`);
    revalidatePath(`/${storeSlug}/admin/inventory/stock`);
    revalidatePath(`/${storeSlug}/manager/inventory/stock`);
    revalidatePath(`/${storeSlug}/admin/finance/cashflow`);
    revalidatePath(`/${storeSlug}/cashier/transactions`);
    return { success: true };
  } catch (error) {
    console.error('Update sale error:', error);
    return { success: false, error: 'Gagal mengupdate penjualan' };
  }
}

export async function deleteSaleAction(id: string) {
  try {
    const { storeId, storeSlug, storeRole, userId } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
      return { success: false, error: 'Unauthorized' };
    }

    const sale = await db.sale.findFirst({ where: { id, storeId }, include: { items: true } });
    if (!sale) return { success: false, error: 'Penjualan tidak ditemukan' };

    await db.$transaction(async (tx) => {
      for (const item of sale.items) {
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { id: true, name: true, stock: true, points: true, type: true } });
        if (variant?.type === 'PREORDER') continue;
        await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
        await tx.stockMovement.create({ data: { storeId, variantId: item.variantId, quantity: item.quantity, type: 'IN', notes: `Stok dikembalikan dari penghapusan ${sale.saleNumber}` } });
      }

      if (sale.customerId) {
        const earned   = Number(sale.pointsEarned);
        const redeemed = Number(sale.pointsRedeemed);

        if (earned > 0) {
          await tx.storeUser.update({ where: { storeId_userId: { storeId, userId: sale.customerId } }, data: { points: { decrement: earned } } });
          await tx.pointHistory.create({ data: { userId: sale.customerId, storeId, points: -earned, type: 'ADJUSTED', description: `Poin dikembalikan dari penghapusan ${sale.saleNumber}` } });
        }
        if (redeemed > 0) {
          await tx.storeUser.update({ where: { storeId_userId: { storeId, userId: sale.customerId } }, data: { points: { increment: redeemed } } });
          await tx.pointHistory.create({ data: { userId: sale.customerId, storeId, points: redeemed, type: 'ADJUSTED', description: `Poin dikembalikan dari penghapusan ${sale.saleNumber}` } });
        }
      }

      await tx.cashflow.create({
        data: {
          storeId,
          type: 'EXPENSE',
          category: 'Penghapusan Penjualan',
          amount: Number(sale.total),
          description: `Penghapusan ${sale.saleNumber}`,
          date: new Date(),
          saleId: id,
          createdById: userId,
        },
      });

      await tx.sale.delete({ where: { id } });
    });

    revalidatePath(`/${storeSlug}/admin/transactions/sales`);
    revalidatePath(`/${storeSlug}/manager/transactions/sales`);
    revalidatePath(`/${storeSlug}/admin/inventory/stock`);
    revalidatePath(`/${storeSlug}/manager/inventory/stock`);
    revalidatePath(`/${storeSlug}/admin/finance/cashflow`);
    return { success: true };
  } catch (error) {
    console.error('Delete sale error:', error);
    return { success: false, error: 'Gagal menghapus penjualan' };
  }
}
