import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { ProductDialog } from '@/components/products/product-dialog';
import { ProductCard } from '@/components/products/product-card';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';
import { auth } from '@/auth';

async function getProducts(params: {
  search?: string;
  status?: string;
  sort?: string;
}) {
  const { search = '', status = 'all', sort = 'name_asc' } = params;

  const where: any = {};

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
  searchParams: Promise<{ search?: string; status?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const search = params.search || '';
  const status = params.status || 'all';
  const sort   = params.sort   || 'name_asc';

  const [products, session] = await Promise.all([
    getProducts({ search, status, sort }),
    auth(),
  ]);

  const isAdmin = session?.user?.role === 'ADMINISTRATOR';

  return (
    <div className="space-y-6 md:space-y-8">
      {isAdmin && (
        <>
          <div className="hidden sm:block">
            <ProductDialog mode="create" />
          </div>
          <div className="sm:hidden fixed bottom-24 right-6 z-50">
            <ProductDialog
              mode="create"
              trigger={
                <button className="w-12 h-12 rounded-full bg-[#028697] text-white shadow-lg flex items-center justify-center hover:bg-[#028697]/90 active:scale-95 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              }
            />
          </div>
        </>
      )}

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
            <ProductCard key={product.id} product={product} filterStatus={status} />
          ))
        )}
      </div>
    </div>
  );
}
