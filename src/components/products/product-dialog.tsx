'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { createProductAction, updateProductAction } from '@/actions/products';
import { Plus, Pencil, Package, Clock, Loader2, Box, Tag, AlignLeft } from 'lucide-react';

interface CategoryOption {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface ProductDialogProps {
  mode: 'create' | 'edit';
  product?: {
    id: string;
    name: string;
    description: string | null;
    sku: string;
    type?: string;
    categoryId?: string | null;
  };
  categories?: CategoryOption[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const toTitleCase = (val: string) => val.replace(/\b\w/g, (c) => c.toUpperCase());

export function ProductDialog({ mode, product, categories = [], trigger, open: controlledOpen, onOpenChange }: ProductDialogProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen! : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  const [loading, setLoading] = useState(false);
  const [productName, setProductName] = useState(product?.name || '');
  const [productType, setProductType] = useState<'READY_STOCK' | 'PREORDER'>(
    (product?.type as 'READY_STOCK' | 'PREORDER') || 'READY_STOCK'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>(product?.categoryId ?? '');
  const [productSku, setProductSku] = useState(product?.sku || '');
  const [productDesc, setProductDesc] = useState(product?.description || '');
  const { toast } = useToast();

  const isCreate = mode === 'create';

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    formData.set('type', productType);
    if (selectedCategory) formData.set('categoryId', selectedCategory);
    try {
      const result = isCreate
        ? await createProductAction(formData)
        : await updateProductAction(product!.id, formData);

      if (result.success) {
        toast({
          title: isCreate ? 'Produk berhasil dibuat!' : 'Produk diperbarui!',
          description: isCreate
            ? 'Produk baru sudah tersedia di inventaris.'
            : 'Perubahan berhasil disimpan.',
        });
        setOpen(false);
      } else {
        toast({
          title: 'Terjadi kesalahan',
          description: result.error || 'Gagal menyimpan produk.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Terjadi kesalahan',
        description: 'Permintaan tidak dapat diproses.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setProductType((product?.type as 'READY_STOCK' | 'PREORDER') || 'READY_STOCK');
      setProductName(product?.name || '');
      setProductSku(product?.sku || '');
      setProductDesc(product?.description || '');
      setSelectedCategory(product?.categoryId ?? '');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <div onClick={() => setOpen(true)}>{trigger}</div>}
      <DialogTrigger asChild>
        {!trigger && (
          <Button
            variant={isCreate ? 'default' : 'ghost'}
            size={isCreate ? 'default' : 'sm'}
            className={isCreate ? 'bg-[#00a090] hover:bg-[#007868] shadow-sm' : ''}
          >
            {isCreate ? (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Tambah Produk
              </>
            ) : (
              <Pencil className="w-4 h-4" />
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[480px] p-0 gap-0 overflow-hidden border-0 shadow-2xl max-h-[92vh] flex flex-col"
      >
        {/* Header band */}
        <div className="relative bg-gradient-to-br from-[#00a090] to-[#006558] px-6 pt-6 pb-8 shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-8 w-16 h-16 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />

          <div className="relative flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Box className="w-5 h-5 text-white" />
            </div>
            <DialogHeader className="space-y-0.5 text-left p-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">
                {isCreate ? 'Produk Baru' : 'Edit Produk'}
              </DialogTitle>
              <p className="text-white/65 text-xs font-normal">
                {isCreate ? 'Tambahkan produk ke katalog inventaris' : `Mengedit: ${product?.name}`}
              </p>
            </DialogHeader>
          </div>
        </div>

        {/* Form body — scrollable */}
        <form action={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 pt-5 pb-2 space-y-4 overflow-y-auto flex-1">

            {/* Default type selector */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Tipe Default Varian Baru</p>
              <p className="text-[11px] text-gray-400 -mt-1">Varian baru akan otomatis menggunakan tipe ini. Bisa diubah per-varian.</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'READY_STOCK' as const, icon: Package, label: 'Ready Stock', sublabel: 'Stok dilacak', activeClass: 'border-[#00a090] bg-[#00a090]/8 text-[#00a090]' },
                  { value: 'PREORDER' as const, icon: Clock, label: 'Pre-Order', sublabel: 'Tanpa batas stok', activeClass: 'border-amber-500 bg-amber-50 text-amber-700' },
                ]).map(({ value, icon: Icon, label, sublabel, activeClass }) => {
                  const active = productType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setProductType(value)}
                      disabled={loading}
                      className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-all disabled:opacity-50 ${
                        active ? activeClass : 'border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-tight">{label}</p>
                        <p className="text-[10px] opacity-60 leading-tight mt-0.5">{sublabel}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Product name */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                <Tag className="w-3 h-3" />
                Nama Produk <span className="text-red-400">*</span>
              </label>
              <Input
                id="name"
                name="name"
                required
                value={productName}
                onChange={(e) => setProductName(toTitleCase(e.target.value))}
                placeholder="Contoh: Kue Lapis, Tart Coklat"
                disabled={loading}
                maxLength={30}
                className="h-9 text-sm border-gray-200 focus-visible:ring-[#00a090]/30 focus-visible:border-[#00a090] transition-colors placeholder:text-gray-300"
              />
            </div>

            {/* SKU */}
            <div className="space-y-1.5">
              <label htmlFor="sku" className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                <span className="font-mono text-[10px] border border-gray-300 rounded px-1 py-0.5 text-gray-400">SKU</span>
                Kode Produk <span className="text-red-400">*</span>
              </label>
              <Input
                id="sku"
                name="sku"
                required
                value={productSku}
                onChange={(e) => setProductSku(e.target.value.toUpperCase())}
                placeholder="Contoh: KL-001"
                disabled={loading}
                maxLength={15}
                className="h-9 text-sm font-mono tracking-wider border-gray-200 focus-visible:ring-[#00a090]/30 focus-visible:border-[#00a090] transition-colors placeholder:text-gray-300 placeholder:font-sans placeholder:tracking-normal uppercase"
              />
            </div>

            {/* Kategori */}
            {categories.length > 0 && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                  <Tag className="w-3 h-3" />
                  Kategori
                  <span className="ml-auto font-normal normal-case tracking-normal text-gray-300 text-[11px]">Opsional</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                      !selectedCategory
                        ? 'bg-gray-100 border-gray-400 text-gray-700'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    Tanpa Kategori
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border flex items-center gap-1 ${
                        selectedCategory === cat.id ? 'border-2' : 'border hover:opacity-80'
                      }`}
                      style={
                        selectedCategory === cat.id
                          ? { backgroundColor: (cat.color ?? '#00a090') + '20', borderColor: cat.color ?? '#00a090', color: cat.color ?? '#00a090' }
                          : { backgroundColor: (cat.color ?? '#00a090') + '10', borderColor: (cat.color ?? '#00a090') + '40', color: cat.color ?? '#00a090' }
                      }
                    >
                      {cat.icon && <span>{cat.icon}</span>}
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-1.5">
              <label htmlFor="description" className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                <AlignLeft className="w-3 h-3" />
                Deskripsi
                <span className="ml-auto font-normal normal-case tracking-normal text-gray-300 text-[11px]">Opsional</span>
              </label>
              <Input
                id="description"
                name="description"
                value={productDesc}
                onChange={(e) => setProductDesc(e.target.value)}
                placeholder="Deskripsi singkat produk..."
                disabled={loading}
                maxLength={150}
                className="h-9 text-sm border-gray-200 focus-visible:ring-[#00a090]/30 focus-visible:border-[#00a090] transition-colors placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#00a090] hover:bg-[#007868] text-white shadow-sm min-w-[110px] transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menyimpan...
                </span>
              ) : isCreate ? (
                <span className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  Buat Produk
                </span>
              ) : (
                'Simpan Perubahan'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}