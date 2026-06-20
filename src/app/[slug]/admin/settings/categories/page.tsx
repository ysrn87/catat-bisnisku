import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryDialog } from '@/components/categories/category-dialog';
import { CategoryManagerClient } from '@/components/categories/category-manager-client';
import { Tag, Package } from 'lucide-react';

async function getCategories(storeId: string) {
  return db.category.findMany({
    where: { storeId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
}

export default async function CategoriesPage() {
  const { storeId } = await getStoreContext();
  const categories = await getCategories(storeId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold hidden md:block">Kategori Produk</h2>
          <p className="text-sm text-gray-500 hidden md:block">
            Kelola kategori untuk mengelompokkan produk
          </p>
        </div>
        <CategoryDialog
          mode="create"
          trigger={
            <div>
              <button className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-[#028697] text-white hover:bg-[#017585] shadow-sm transition-colors">
                <Tag className="w-4 h-4" />
                Tambah Kategori
              </button>
              <button
                type="button"
                className="sm:hidden fixed bottom-24 right-6 z-50
                           w-12 h-12 rounded-full bg-[#028697] text-white shadow-lg
                           flex items-center justify-center
                           hover:bg-[#017585] active:scale-95 transition-all"
                aria-label="Tambah Kategori"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          }
        />
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Tag className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-gray-500 font-medium">Belum ada kategori</p>
            <p className="text-sm text-gray-400">
              Buat kategori untuk mengelompokkan produk seperti "Makanan", "Minuman", dll.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <CategoryManagerClient key={cat.id} category={cat} />
          ))}
        </div>
      )}

      {/* Info */}
      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <Package className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 space-y-1">
              <p className="font-medium">Tentang Kategori</p>
              <ul className="text-xs text-blue-600 space-y-0.5 list-disc list-inside">
                <li>Kategori bersifat opsional — produk bisa tanpa kategori</li>
                <li>Menghapus kategori tidak menghapus produknya</li>
                <li>Bisa set kategori langsung dari halaman produk</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
