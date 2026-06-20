import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { ProductDialog } from '@/components/products/product-dialog';
import { ProductCard } from '@/components/products/product-card';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';
import { auth } from '@/auth';
import { Suspense } from 'react';
import { getStoreContext } from '@/lib/store-context';
import { ProductActions } from '@/components/page-actions/product-actions';

async function getProducts(storeId: string, params: {
  search?: string;
  status?: string;
  sort?: string;
  category?: string;
}) {
  const { search = '', status = 'all', sort = 'name_asc' } = params;

  const { category = 'all' } = params;

  const where: any = { storeId };
  if (category !== 'all') where.categoryId = category === 'none' ? null : category;

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' as const } },
      { sku: { contains: search, mode: 'insensitive' as const } },
      { description: { contains: search, mode: 'insensitive' as const } },
      { variants: { some: { name: { contains: search, mode: 'insensitive' as const } } } },
    ];
  }

  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;

  const orderBy: any = [];
  switch (sort) {
    case 'name_desc': orderBy.push({ name: 'desc' }); break;
    case 'newest':    orderBy.push({ createdAt: 'desc' }); break;
    case 'oldest':    orderBy.push({ createdAt: 'asc' }); break;
    default:          orderBy.push({ name: 'asc' });
  }

  const products = await db.product.findMany({
    where,
    include: {
      variants: true,
      createdBy: { select: { name: true } },
      category: { select: { id: true, name: true, color: true, icon: true } },
    },
    orderBy,
  });

  return products.map((product: typeof products[number]) => ({
    ...product,
    variants: product.variants.map((v: typeof product.variants[number]) => ({
      ...v,
      price: Number(v.price),
      cost: Number(v.cost),
    })),
  }));
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; sort?: string; category?: string }>;
}) {
  const params = await searchParams;
  const search   = params.search   || '';
  const status   = params.status   || 'all';
  const sort     = params.sort     || 'name_asc';
  const category = params.category || 'all';

  const [{ storeId }, session] = await Promise.all([
    getStoreContext(),
    auth(),
  ]);

  const [products, categories] = await Promise.all([
    getProducts(storeId, { search, status, sort, category }),
    db.category.findMany({ where: { storeId }, orderBy: { name: 'asc' }, select: { id: true, name: true, color: true, icon: true } }),
  ]);

  const isAdmin = session?.user?.role === 'ADMINISTRATOR';

  return (
    <div className="space-y-6 md:space-y-8">
      <ProductActions isAdmin={isAdmin} categories={categories} />

      <SearchFilterBar
        searchPlaceholder="Cari produk berdasarkan nama, SKU, atau varian..."
        filters={[
          {
            key: 'status',
            label: 'Status Produk',
            defaultValue: 'all',
            options: [
              { value: 'all',      label: 'Semua Produk' },
              { value: 'active',   label: 'Aktif' },
              { value: 'inactive', label: 'Nonaktif' },
            ],
          },
          ...(categories.length > 0 ? [{
            key: 'category',
            label: 'Kategori',
            defaultValue: 'all',
            options: [
              { value: 'all',  label: 'Semua Kategori' },
              { value: 'none', label: 'Tanpa Kategori' },
              ...categories.map((c) => ({ value: c.id, label: `${c.icon ?? ''} ${c.name}`.trim() })),
            ],
          }] : []),
        ]}
        sortOptions={[
          { value: 'name_asc',  label: 'Nama (A-Z)' },
          { value: 'name_desc', label: 'Nama (Z-A)' },
          { value: 'newest',    label: 'Terbaru' },
          { value: 'oldest',    label: 'Terlama' },
        ]}
        defaultSort="name_asc"
      />

      <div className="space-y-4 md:space-y-6">
        {products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {search
                  ? `Tidak ada produk yang cocok dengan "${search}"`
                  : 'Belum ada produk tersedia. Buat produk pertama!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          products.map((product: typeof products[number]) => (
            <ProductCard key={product.id} product={product} filterStatus={status} categories={categories} isAdmin={isAdmin} />
          ))
        )}
      </div>
    </div>
  );
}
