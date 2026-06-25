'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess } from '@/lib/store-context';

export async function adjustStockAction(formData: FormData) {
  try {
    const { storeId, storeSlug } = await requireStoreAccess();
    // FIX: userId tidak diperlukan lagi (cashflow tidak butuh createdById)

    const variantId = formData.get('variantId') as string;
    // FIX: type sekarang pakai MovementType enum: PURCHASE | ADJUSTMENT | RETURN | DAMAGED
    const type      = formData.get('type') as 'PURCHASE' | 'ADJUSTMENT' | 'RETURN' | 'DAMAGED';
    const quantity  = parseInt(formData.get('quantity') as string);
    const notes     = (formData.get('reason') as string) || undefined;

    if (!variantId || !type || !quantity) {
      return { success: false, error: 'Data tidak lengkap' };
    }

    const variant = await db.productVariant.findFirst({
      where:   { id: variantId, storeId },
      include: { product: true },
    });
    if (!variant) return { success: false, error: 'Varian produk tidak ditemukan' };

    const isPreorder = variant.type === 'PREORDER';

    let newStock    = variant.stock;
    let signedQty   = quantity; // positif = masuk, negatif = keluar

    if (!isPreorder) {
      if (type === 'PURCHASE') {
        newStock  += quantity;
        signedQty  = quantity;   // masuk
      } else if (type === 'RETURN') {
        newStock  += quantity;
        signedQty  = quantity;   // masuk
      } else if (type === 'DAMAGED') {
        newStock  -= quantity;
        signedQty  = -quantity;  // keluar
      } else if (type === 'ADJUSTMENT') {
        signedQty  = quantity - variant.stock; // delta dari current
        newStock   = quantity;
      }

      if (newStock < 0) return { success: false, error: 'Stok tidak mencukupi' };
    }

    await db.$transaction(async (tx) => {
      if (!isPreorder) {
        await tx.productVariant.update({
          where: { id: variantId },
          data:  { stock: newStock },
        });

        // FIX: quantity signed (positif/negatif), type pakai MovementType enum
        await tx.stockMovement.create({
          data: { storeId, variantId, type, quantity: signedQty, notes },
        });
      }

      // Catat cashflow untuk pembelian stok masuk
      if (!isPreorder && type === 'PURCHASE' && quantity > 0) {
        await tx.cashflow.create({
          data: {
            storeId,
            type:        'EXPENSE',
            category:    'Pembelian Inventaris',
            amount:      Number(variant.cost) * quantity,
            description: `Pembelian ${quantity} unit ${variant.product.name} - ${variant.name}${notes ? ` (${notes})` : ''}`,
            occurredAt:  new Date(), // FIX: was date (field baru)
            // FIX: hapus createdById
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
