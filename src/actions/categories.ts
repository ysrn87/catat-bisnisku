'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireStoreAccess, getStoreContext } from '@/lib/store-context';

export interface CategoryData {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  _count?: { products: number };
}

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<CategoryData[]> {
  const { storeId } = await getStoreContext();

  return db.category.findMany({
    where: { storeId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
}

// ─── Create ────────────────────────────────────────────────────────────────────

export async function createCategoryAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  category?: CategoryData;
}> {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized' };
    }

    const name  = (formData.get('name')  as string)?.trim();
    const color = (formData.get('color') as string)?.trim() || null;
    const icon  = (formData.get('icon')  as string)?.trim() || null;

    if (!name) return { success: false, error: 'Nama kategori wajib diisi' };
    if (name.length > 50) return { success: false, error: 'Nama kategori maksimal 50 karakter' };

    // Cek duplikat nama per store
    const existing = await db.category.findUnique({
      where: { storeId_name: { storeId, name } },
    });
    if (existing) return { success: false, error: `Kategori "${name}" sudah ada` };

    const category = await db.category.create({
      data: { storeId, name, color, icon, updatedAt: new Date() },
      include: { _count: { select: { products: true } } },
    });

    revalidatePath(`/${storeSlug}/admin/settings/categories`);
    revalidatePath(`/${storeSlug}/admin/inventory/products`);
    revalidatePath(`/${storeSlug}/manager/inventory/products`);

    return { success: true, category };
  } catch (error) {
    console.error('Create category error:', error);
    return { success: false, error: 'Gagal membuat kategori' };
  }
}

// ─── Update ────────────────────────────────────────────────────────────────────

export async function updateCategoryAction(id: string, formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized' };
    }

    const name  = (formData.get('name')  as string)?.trim();
    const color = (formData.get('color') as string)?.trim() || null;
    const icon  = (formData.get('icon')  as string)?.trim() || null;

    if (!name) return { success: false, error: 'Nama kategori wajib diisi' };
    if (name.length > 50) return { success: false, error: 'Nama kategori maksimal 50 karakter' };

    // Pastikan kategori milik store ini
    const category = await db.category.findFirst({ where: { id, storeId } });
    if (!category) return { success: false, error: 'Kategori tidak ditemukan' };

    // Cek duplikat nama (kecuali diri sendiri)
    const existing = await db.category.findFirst({
      where: { storeId, name, NOT: { id } },
    });
    if (existing) return { success: false, error: `Kategori "${name}" sudah ada` };

    await db.category.update({
      where: { id },
      data: { name, color, icon, updatedAt: new Date() },
    });

    revalidatePath(`/${storeSlug}/admin/settings/categories`);
    revalidatePath(`/${storeSlug}/admin/inventory/products`);
    revalidatePath(`/${storeSlug}/manager/inventory/products`);

    return { success: true };
  } catch (error) {
    console.error('Update category error:', error);
    return { success: false, error: 'Gagal mengupdate kategori' };
  }
}

// ─── Delete ────────────────────────────────────────────────────────────────────

export async function deleteCategoryAction(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized' };
    }

    const category = await db.category.findFirst({
      where: { id, storeId },
      include: { _count: { select: { products: true } } },
    });
    if (!category) return { success: false, error: 'Kategori tidak ditemukan' };

    // Hapus kategori — products yang pakai kategori ini akan set categoryId = null (onDelete: SetNull)
    await db.category.delete({ where: { id } });

    revalidatePath(`/${storeSlug}/admin/settings/categories`);
    revalidatePath(`/${storeSlug}/admin/inventory/products`);
    revalidatePath(`/${storeSlug}/manager/inventory/products`);

    return { success: true };
  } catch (error) {
    console.error('Delete category error:', error);
    return { success: false, error: 'Gagal menghapus kategori' };
  }
}

// ─── Assign kategori ke produk ────────────────────────────────────────────────

export async function assignCategoryAction(
  productId: string,
  categoryId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { storeId, storeSlug, storeRole } = await requireStoreAccess();

    if (storeRole !== 'OWNER' && storeRole !== 'ADMINISTRATOR' && storeRole !== 'MANAGER') {
      return { success: false, error: 'Unauthorized' };
    }

    // Pastikan produk milik store ini
    const product = await db.product.findFirst({ where: { id: productId, storeId } });
    if (!product) return { success: false, error: 'Produk tidak ditemukan' };

    // Pastikan kategori (jika diisi) milik store ini
    if (categoryId) {
      const category = await db.category.findFirst({ where: { id: categoryId, storeId } });
      if (!category) return { success: false, error: 'Kategori tidak ditemukan' };
    }

    await db.product.update({
      where: { id: productId },
      data: { categoryId },
    });

    revalidatePath(`/${storeSlug}/admin/inventory/products`);
    revalidatePath(`/${storeSlug}/manager/inventory/products`);

    return { success: true };
  } catch (error) {
    console.error('Assign category error:', error);
    return { success: false, error: 'Gagal mengubah kategori produk' };
  }
}
