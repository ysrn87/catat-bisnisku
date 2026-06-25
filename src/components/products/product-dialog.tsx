'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { createProductAction, updateProductAction } from '@/actions/products';
import { createCategoryAction } from '@/actions/categories';
import { Plus, Pencil, Package, Clock, Loader2, Box, Tag, AlignLeft, ChevronDown, Check, Sparkles } from 'lucide-react';

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
    sku?: string;
    type?: string;
    categoryId?: string | null;
  };
  categories?: CategoryOption[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hanya OWNER/ADMINISTRATOR yang boleh membuat kategori baru lewat dialog ini */
  isAdmin?: boolean;
}

const toTitleCase = (val: string) => val.replace(/\b\w/g, (c) => c.toUpperCase());

export function ProductDialog({ mode, product, categories = [], trigger, open: controlledOpen, onOpenChange, isAdmin = false }: ProductDialogProps) {
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
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const [productSku, setProductSku] = useState(product?.sku || '');
  const [productDesc, setProductDesc] = useState(product?.description || '');
  const { toast } = useToast();

  const isCreate = mode === 'create';
  const useCategoryDropdown = categories.length > 3;

  // Tutup dropdown kategori saat klik di luar
  useEffect(() => {
    if (!categoryMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setCategoryMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [categoryMenuOpen]);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    formData.set('type', productType);

    try {
      let categoryId = selectedCategory;

      // Jika user pilih "Kategori Lainnya", buat kategori baru dulu
      if (isNewCategory && isAdmin) {
        const trimmedName = newCategoryName.trim();
        if (!trimmedName) {
          toast({
            title: 'Terjadi kesalahan',
            description: 'Nama kategori baru wajib diisi.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        const catFormData = new FormData();
        catFormData.set('name', trimmedName);

        const catResult = await createCategoryAction(catFormData);
        if (!catResult.success || !catResult.category) {
          toast({
            title: 'Gagal membuat kategori',
            description: catResult.error || 'Tidak dapat membuat kategori baru.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        categoryId = catResult.category.id;
      }

      if (categoryId) formData.set('categoryId', categoryId);

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
      setIsNewCategory(false);
      setNewCategoryName('');
      setCategoryMenuOpen(false);
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
            className={isCreate ? 'bg-[#028697] hover:bg-[#017585] shadow-sm' : ''}
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
        <div className="relative bg-gradient-to-br from-[#028697] to-[#015561] px-6 pt-6 pb-8 shrink-0">
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
                  { value: 'READY_STOCK' as const, icon: Package, label: 'Ready Stock', sublabel: 'Stok dilacak', activeClass: 'border-[#028697] bg-[#028697]/8 text-[#028697]' },
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
                className="h-9 text-sm border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
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
                className="h-9 text-sm font-mono tracking-wider border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300 placeholder:font-sans placeholder:tracking-normal uppercase"
              />
            </div>

            {/* Kategori */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                <Tag className="w-3 h-3" />
                Kategori
                <span className="ml-auto font-normal normal-case tracking-normal text-gray-300 text-[11px]">Opsional</span>
              </label>

              {useCategoryDropdown ? (
                /* ── Dropdown (lebih dari 3 kategori) ── */
                <div className="relative" ref={categoryMenuRef}>
                  <button
                    type="button"
                    onClick={() => setCategoryMenuOpen((v) => !v)}
                    disabled={loading}
                    className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-left text-sm flex items-center gap-2 hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors disabled:opacity-50"
                  >
                    {isNewCategory ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-[#028697] shrink-0" />
                        <span className="text-gray-700 truncate">Kategori Lainnya</span>
                      </>
                    ) : selectedCategory ? (
                      (() => {
                        const cat = categories.find((c) => c.id === selectedCategory);
                        return (
                          <>
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: cat?.color ?? '#028697' }}
                            />
                            <span className="text-gray-700 truncate">
                              {cat?.icon ? `${cat.icon} ` : ''}{cat?.name ?? 'Kategori'}
                            </span>
                          </>
                        );
                      })()
                    ) : (
                      <span className="text-gray-400">Tanpa Kategori</span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 ml-auto shrink-0 transition-transform ${categoryMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {categoryMenuOpen && (
                    <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('');
                          setIsNewCategory(false);
                          setCategoryMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-between"
                      >
                        Tanpa Kategori
                        {!selectedCategory && !isNewCategory && <Check className="w-3.5 h-3.5 text-[#028697]" />}
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            setIsNewCategory(false);
                            setCategoryMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color ?? '#028697' }}
                          />
                          <span className="truncate">{cat.icon ? `${cat.icon} ` : ''}{cat.name}</span>
                          {selectedCategory === cat.id && !isNewCategory && <Check className="w-3.5 h-3.5 text-[#028697] ml-auto shrink-0" />}
                        </button>
                      ))}
                      {isAdmin && (
                        <>
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            type="button"
                            onClick={() => {
                              setIsNewCategory(true);
                              setSelectedCategory('');
                              setCategoryMenuOpen(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-[#028697] hover:bg-[#e0f9fc] flex items-center gap-2 font-medium"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Kategori Lainnya
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Pill buttons (3 kategori atau kurang) ── */
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setSelectedCategory(''); setIsNewCategory(false); }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                      !selectedCategory && !isNewCategory
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
                      onClick={() => {
                        setIsNewCategory(false);
                        setSelectedCategory(selectedCategory === cat.id ? '' : cat.id);
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border flex items-center gap-1 ${
                        selectedCategory === cat.id && !isNewCategory ? 'border-2' : 'border hover:opacity-80'
                      }`}
                      style={
                        selectedCategory === cat.id && !isNewCategory
                          ? { backgroundColor: (cat.color ?? '#028697') + '20', borderColor: cat.color ?? '#028697', color: cat.color ?? '#028697' }
                          : { backgroundColor: (cat.color ?? '#028697') + '10', borderColor: (cat.color ?? '#028697') + '40', color: cat.color ?? '#028697' }
                      }
                    >
                      {cat.icon && <span>{cat.icon}</span>}
                      {cat.name}
                    </button>
                  ))}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => { setIsNewCategory((v) => !v); setSelectedCategory(''); }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border flex items-center gap-1 ${
                        isNewCategory
                          ? 'bg-[#028697]/10 border-[#028697] text-[#028697] border-2'
                          : 'border-dashed border-gray-300 text-gray-500 hover:border-[#028697] hover:text-[#028697]'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                      Kategori Lainnya
                    </button>
                  )}
                </div>
              )}

              {/* Input nama kategori baru */}
              {isNewCategory && (
                <Input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nama kategori baru, contoh: Minuman"
                  disabled={loading}
                  maxLength={50}
                  className="h-9 text-sm border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300 mt-1.5"
                />
              )}
            </div>

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
                className="h-9 text-sm border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
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
              className="bg-[#028697] hover:bg-[#017585] text-white shadow-sm min-w-[110px] transition-all"
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