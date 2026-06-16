'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CategoryDialog } from './category-dialog';
import { deleteCategoryAction } from '@/actions/categories';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { Tag, Pencil, Trash2, Package, Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CategoryItem {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  _count: { products: number };
}

interface CategoryManagerClientProps {
  category: CategoryItem;
}

export function CategoryManagerClient({ category }: CategoryManagerClientProps) {
  const [editOpen, setEditOpen]       = useState(false);
  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const color = category.color ?? '#00a090';

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteCategoryAction(category.id);
    if (result.success) {
      toast({ title: `Kategori "${category.name}" dihapus` });
      setDeleteOpen(false);
      router.refresh();
    } else {
      toast({ title: 'Gagal menghapus', description: result.error, variant: 'destructive' });
    }
    setDeleting(false);
  }

  return (
    <>
      {/* Edit Dialog */}
      <CategoryDialog
        mode="edit"
        category={category}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => router.refresh()}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Hapus Kategori?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-gray-600">
            {category._count.products > 0 ? (
              <p>
                <span className="font-semibold">{category._count.products} produk</span> yang
                menggunakan kategori <span className="font-semibold">"{category.name}"</span> akan
                menjadi tanpa kategori. Produknya tidak akan dihapus.
              </p>
            ) : (
              <p>
                Kategori <span className="font-semibold">"{category.name}"</span> tidak digunakan
                oleh produk manapun.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Batal
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Menghapus...</>
                : 'Hapus'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Card */}
      <Card className="group hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            {/* Icon + name */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: color + '20', border: `2px solid ${color}` }}
              >
                {category.icon || <Tag className="w-4 h-4" style={{ color }} />}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color }}>
                  {category.name}
                </p>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Package className="w-3 h-3" />
                  {category._count.products} produk
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button
                onClick={() => setEditOpen(true)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#00a090] hover:bg-[#e0f5f2] transition-colors"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setDeleteOpen(true)}
                disabled={deleting}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Hapus"
              >
                {deleting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          </div>

          {/* Color bar */}
          <div className="mt-3 h-1 rounded-full" style={{ backgroundColor: color }} />
        </CardContent>
      </Card>
    </>
  );
}
