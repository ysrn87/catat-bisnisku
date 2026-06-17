'use server';

import { db } from '@/lib/db';
import { sanitizeName, sanitizeText, sanitizeSku } from '@/lib/sanitize';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess, checkPlanLimit } from '@/lib/store-context';

export async function createProductAction(formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole, userId } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
      return { success: false, error: 'Unauthorized' };
    }

    // Cek plan limit FREE: maks 50 produk
    const limit = await checkPlanLimit('products');
    if (!limit.allowed) {
      return {
        success: false,
        error: `Batas plan FREE tercapai (${limit.current}/${limit.limit} produk). Upgrade ke PRO untuk daftarkan hingga 1000 produk.`,
      };
    }

    const name        = sanitizeName(formData.get('name') as string, 100);
    const description = sanitizeText(formData.get('description') as string, 500);
    const sku         = sanitizeSku(formData.get('sku') as string);
    const type        = (formData.get('type') as string) || 'READY_STOCK';
    const categoryId  = (formData.get('categoryId') as string) || null;

    if (!name || !sku) return { success: false, error: 'Nama dan SKU wajib diisi' };

    const existingSKU = await db.product.findUnique({ where: { storeId_sku: { storeId, sku } } });
    if (existingSKU) return { success: false, error: 'SKU sudah digunakan' };

    await db.product.create({
      data: { storeId, name, description: description || null, sku, type: type as 'READY_STOCK' | 'PREORDER', createdById: userId, categoryId },
    });

    revalidatePath(`/${storeSlug}/admin/inventory/products`);
    revalidatePath(`/${storeSlug}/manager/inventory/products`);
    return { success: true };
  } catch (error) {
    console.error('Create product error:', error);
    return { success: false, error: 'Gagal membuat produk' };
  }
}

export async function updateProductAction(id: string, formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole, userId } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
      return { success: false, error: 'Unauthorized' };
    }

    const name        = sanitizeName(formData.get('name') as string, 100);
    const description = sanitizeText(formData.get('description') as string, 500);
    const sku         = sanitizeSku(formData.get('sku') as string);
    const type        = (formData.get('type') as string) || 'READY_STOCK';
    const categoryId  = (formData.get('categoryId') as string) || null;

    if (!name || !sku) return { success: false, error: 'Nama dan SKU wajib diisi' };

    // Pastikan produk milik store ini
    const product = await db.product.findFirst({ where: { id, storeId } });
    if (!product) return { success: false, error: 'Produk tidak ditemukan' };

    const existingSKU = await db.product.findFirst({ where: { storeId, sku, NOT: { id } } });
    if (existingSKU) return { success: false, error: 'SKU sudah digunakan' };

    await db.product.update({
      where: { id },
      data: { name, description: description || null, sku, type: type as 'READY_STOCK' | 'PREORDER', categoryId, updatedById: userId },
    });

    revalidatePath(`/${storeSlug}/admin/inventory/products`);
    revalidatePath(`/${storeSlug}/manager/inventory/products`);
    return { success: true };
  } catch (error) {
    console.error('Update product error:', error);
    return { success: false, error: 'Gagal mengupdate produk' };
  }
}

export async function deleteProductAction(id: string) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
      return { success: false, error: 'Unauthorized' };
    }

    const product = await db.product.findFirst({ where: { id, storeId } });
    if (!product) return { success: false, error: 'Produk tidak ditemukan' };

    await db.product.delete({ where: { id } });

    revalidatePath(`/${storeSlug}/admin/inventory/products`);
    revalidatePath(`/${storeSlug}/manager/inventory/products`);
    return { success: true };
  } catch (error) {
    console.error('Delete product error:', error);
    return { success: false, error: 'Gagal menghapus produk. Pastikan tidak ada varian yang tersisa.' };
  }
}

export async function createVariantAction(formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole, userId } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
      return { success: false, error: 'Unauthorized' };
    }

    const productId  = formData.get('productId')  as string;
    const name       = formData.get('name')        as string;
    const sku        = formData.get('sku')         as string;
    const barcodeRaw = (formData.get('barcode') as string)?.trim() || '';
    const barcode    = barcodeRaw !== '' ? barcodeRaw : null;
    const price      = parseFloat(formData.get('price')    as string);
    const cost       = parseFloat(formData.get('cost')     as string);
    const stock      = parseInt(formData.get('stock')      as string);
    const lowStock   = parseInt(formData.get('lowStock')   as string);
    const points     = parseInt(formData.get('points')     as string) || 0;

    if (!productId || !name || !sku || isNaN(price) || isNaN(cost) || isNaN(stock) || isNaN(lowStock)) {
      return { success: false, error: 'Semua field wajib diisi' };
    }

    // Pastikan product milik store ini
    const product = await db.product.findFirst({ where: { id: productId, storeId } });
    if (!product) return { success: false, error: 'Produk tidak ditemukan' };

    // Cek plan limit: maks varian per produk (FREE = 3, PRO = 10)
    const limit = await checkPlanLimit('variantsPerProduct', productId);
    if (!limit.allowed) {
      return {
        success: false,
        error: `Batas varian per produk tercapai (${limit.current}/${limit.limit}). Upgrade ke PRO untuk hingga 10 varian per produk.`,
      };
    }

    const existingSKU = await db.productVariant.findUnique({ where: { storeId_sku: { storeId, sku } } });
    if (existingSKU) return { success: false, error: 'SKU varian sudah digunakan' };

    if (barcode) {
      const existingBarcode = await db.productVariant.findUnique({ where: { storeId_barcode: { storeId, barcode } } });
      if (existingBarcode) return { success: false, error: 'Barcode sudah digunakan oleh varian lain' };
    }

    const variant = await db.productVariant.create({
      data: { storeId, productId, name, sku, barcode, price, cost, stock, lowStock, points },
    });

    const isPreorder = product.type === 'PREORDER';

    if (!isPreorder && stock > 0) {
      await db.stockMovement.create({
        data: { storeId, variantId: variant.id, quantity: stock, type: 'IN', notes: 'Stok Awal' },
      });

      await db.cashflow.create({
        data: {
          storeId,
          type: 'EXPENSE',
          category: 'Pembelian Inventaris',
          amount: cost * stock,
          description: `Penambahan Stok Awal: ${name} (${sku}) - ${stock} units`,
          date: new Date(),
          createdById: userId,
        },
      });
    }

    revalidatePath(`/${storeSlug}/admin/inventory/products`);
    revalidatePath(`/${storeSlug}/manager/inventory/products`);
    revalidatePath(`/${storeSlug}/admin/inventory/stock`);
    revalidatePath(`/${storeSlug}/manager/inventory/stock`);
    revalidatePath(`/${storeSlug}/admin/finance/cashflow`);
    return { success: true };
  } catch (error) {
    console.error('Create variant error:', error);
    return { success: false, error: 'Gagal membuat varian' };
  }
}

export async function updateVariantAction(id: string, formData: FormData) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
      return { success: false, error: 'Unauthorized' };
    }

    const name       = formData.get('name')      as string;
    const sku        = formData.get('sku')        as string;
    const barcodeRaw = (formData.get('barcode') as string)?.trim() || '';
    const barcode    = barcodeRaw !== '' ? barcodeRaw : null;
    const price      = parseFloat(formData.get('price')    as string);
    const cost       = parseFloat(formData.get('cost')     as string);
    const lowStock   = parseInt(formData.get('lowStock')   as string);
    const points     = parseInt(formData.get('points')     as string) || 0;

    if (!name || !sku || isNaN(price) || isNaN(cost) || isNaN(lowStock)) {
      return { success: false, error: 'Semua field wajib diisi' };
    }

    const variant = await db.productVariant.findFirst({ where: { id, storeId } });
    if (!variant) return { success: false, error: 'Varian tidak ditemukan' };

    const existingSKU = await db.productVariant.findFirst({ where: { storeId, sku, NOT: { id } } });
    if (existingSKU) return { success: false, error: 'SKU varian sudah digunakan' };

    if (barcode) {
      const existingBarcode = await db.productVariant.findFirst({ where: { storeId, barcode, NOT: { id } } });
      if (existingBarcode) return { success: false, error: 'Barcode sudah digunakan oleh varian lain' };
    }

    await db.productVariant.update({ where: { id }, data: { name, sku, barcode, price, cost, lowStock, points } });

    revalidatePath(`/${storeSlug}/admin/inventory/products`);
    revalidatePath(`/${storeSlug}/manager/inventory/products`);
    return { success: true };
  } catch (error) {
    console.error('Update variant error:', error);
    return { success: false, error: 'Gagal mengupdate varian' };
  }
}

export async function deleteVariantAction(id: string) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
      return { success: false, error: 'Unauthorized' };
    }

    const variant = await db.productVariant.findFirst({ where: { id, storeId } });
    if (!variant) return { success: false, error: 'Varian tidak ditemukan' };

    await db.productVariant.delete({ where: { id } });

    revalidatePath(`/${storeSlug}/admin/inventory/products`);
    revalidatePath(`/${storeSlug}/manager/inventory/products`);
    revalidatePath(`/${storeSlug}/admin/inventory/stock`);
    revalidatePath(`/${storeSlug}/manager/inventory/stock`);
    return { success: true };
  } catch (error) {
    console.error('Delete variant error:', error);
    return { success: false, error: 'Gagal menghapus varian. Pastikan tidak ada penjualan terkait.' };
  }
}

export async function toggleProductActiveAction(id: string, isActive: boolean) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
      return { success: false, error: 'Unauthorized' };
    }

    const product = await db.product.findFirst({ where: { id, storeId } });
    if (!product) return { success: false, error: 'Produk tidak ditemukan' };

    await db.product.update({ where: { id }, data: { isActive } });

    revalidatePath(`/${storeSlug}/admin/inventory/products`);
    revalidatePath(`/${storeSlug}/manager/inventory/products`);
    return { success: true };
  } catch (error) {
    console.error('Toggle product active error:', error);
    return { success: false, error: 'Gagal mengubah status produk' };
  }
}

export async function toggleVariantActiveAction(id: string, isActive: boolean) {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
      return { success: false, error: 'Unauthorized' };
    }

    const variant = await db.productVariant.findFirst({ where: { id, storeId } });
    if (!variant) return { success: false, error: 'Varian tidak ditemukan' };

    await db.productVariant.update({ where: { id }, data: { isActive } });

    revalidatePath(`/${storeSlug}/admin/inventory/products`);
    revalidatePath(`/${storeSlug}/manager/inventory/products`);
    return { success: true };
  } catch (error) {
    console.error('Toggle variant active error:', error);
    return { success: false, error: 'Gagal mengubah status varian' };
  }
}
