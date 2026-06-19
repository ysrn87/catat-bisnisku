'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess } from '@/lib/store-context';

export async function adjustStockAction(formData: FormData) {
  try {
    const { storeId, storeSlug, userId } = await requireStoreAccess();

    const variantId = formData.get('variantId') as string;
    const type      = formData.get('type')      as 'IN' | 'OUT' | 'ADJUSTMENT';
    const quantity  = parseInt(formData.get('quantity') as string);
    const notes     = (formData.get('reason') as string) || undefined;

    if (!variantId || !type || !quantity) {
      return { success: false, error: 'Data tidak lengkap' };
    }

    // Pastikan varian milik store ini
    const variant = await db.productVariant.findFirst({
      where: { id: variantId, storeId },
      include: { product: true },
    });

    if (!variant) return { success: false, error: 'Varian produk tidak ditemukan' };

    const isPreorder = variant.type === 'PREORDER';

    let newStock = variant.stock;
    if (!isPreorder) {
      if (type === 'IN')         newStock += quantity;
      else if (type === 'OUT')   newStock -= quantity;
      else if (type === 'ADJUSTMENT') newStock = quantity;

      if (newStock < 0) return { success: false, error: 'Stok tidak mencukupi' };
    }

    await db.$transaction(async (tx) => {
      if (!isPreorder) {
        await tx.productVariant.update({ where: { id: variantId }, data: { stock: newStock } });
        await tx.stockMovement.create({ data: { storeId, variantId, type, quantity, notes } });
      }

      if (!isPreorder && type === 'IN' && quantity > 0) {
        await tx.cashflow.create({
          data: {
            storeId,
            type: 'EXPENSE',
            category: 'Pembelian Inventaris',
            amount: Number(variant.cost) * quantity,
            description: `Pembelian ${quantity} unit ${variant.product.name} - ${variant.name}${notes ? ` (${notes})` : ''}`,
            date: new Date(),
            createdById: userId,
          },
        });
      }
    });

    revalidatePath(`/${storeSlug}/admin/inventory/stock`);
    revalidatePath(`/${storeSlug}/manager/inventory/stock`);
    revalidatePath(`/${storeSlug}/admin/finance/cashflow`);
    return { success: true };
  } catch (error) {
    console.error('Stock adjustment error:', error);
    return { success: false, error: 'Gagal mengatur stok' };
  }
}
