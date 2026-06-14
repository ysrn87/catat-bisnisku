'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { adjustStockAction } from '@/actions/stock';
import {
  Plus,
  Minus,
  SlidersHorizontal,
  Loader2,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  FileText,
} from 'lucide-react';

interface StockAdjustmentDialogProps {
  variantId: string;
  variantName: string;
  currentStock: number;
}

type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | '';

function FieldLabel({
  icon: Icon,
  label,
  required,
  hint,
}: {
  icon?: React.ElementType;
  label: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <span className="text-[11px] text-gray-300">{hint}</span>}
    </div>
  );
}

const MOVEMENT_TYPES = [
  {
    value: 'IN' as const,
    label: 'Stok Masuk',
    sublabel: 'Tambah stok baru',
    icon: ArrowDownToLine,
    activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    dotClass: 'bg-emerald-500',
    iconClass: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
  },
  {
    value: 'OUT' as const,
    label: 'Stok Keluar',
    sublabel: 'Kurangi stok',
    icon: ArrowUpFromLine,
    activeClass: 'border-red-400 bg-red-50 text-red-700',
    dotClass: 'bg-red-400',
    iconClass: 'text-red-500',
    iconBg: 'bg-red-100',
  },
  {
    value: 'ADJUSTMENT' as const,
    label: 'Refresh Stok',
    sublabel: 'Sesuaikan stok ',
    icon: RefreshCw,
    activeClass: 'border-[#00a090] bg-[#00a090]/8 text-[#00a090]',
    dotClass: 'bg-[#00a090]',
    iconClass: 'text-[#00a090]',
    iconBg: 'bg-[#00a090]/10',
  },
];

export function StockAdjustmentDialog({ variantId, variantName, currentStock }: StockAdjustmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [movementType, setMovementType] = useState<MovementType>('');
  const { toast } = useToast();

  const formatNumber = (value: string): string => {
    const clean = value.replace(/\D/g, '');
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const parseNumber = (value: string): string => value.replace(/,/g, '');

  const handleNumberChange = (value: string) => setQuantity(formatNumber(value));

  // Preview the resulting stock
  const parsedQty = parseInt(parseNumber(quantity)) || 0;
  const previewStock =
    movementType === 'IN' ? currentStock + parsedQty
    : movementType === 'OUT' ? currentStock - parsedQty
    : movementType === 'ADJUSTMENT' ? parsedQty
    : null;

  const handleSubmit = async (formData: FormData) => {
    if (!movementType) {
      toast({ title: 'Pilih tipe pergerakan', description: 'Pilih Stok Masuk, Keluar, atau Penyesuaian.', variant: 'destructive' });
      return;
    }
    formData.set('quantity', parseNumber(quantity));
    formData.set('type', movementType);
    setLoading(true);
    try {
      const result = await adjustStockAction(formData);
      if (result.success) {
        toast({ title: 'Stok berhasil diperbarui!', description: 'Perubahan stok telah disimpan.' });
        setOpen(false);
      } else {
        toast({ title: 'Terjadi kesalahan', description: result.error || 'Gagal mengatur stok.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Terjadi kesalahan', description: 'Permintaan tidak dapat diproses.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setQuantity('');
      setMovementType('');
    }
  };

  const selectedType = MOVEMENT_TYPES.find(t => t.value === movementType);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className=" h-7 w-24 text-xs border-gray-200 hover:border-[#00a090] hover:text-[#00a090] transition-colors">
          <SlidersHorizontal className="w-1 h-1" />
          Atur Stok
        </Button>
      </DialogTrigger>

      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[460px] p-0 gap-0 overflow-hidden border-0 shadow-2xl"
      >
        {/* Header band */}
        <div className="relative bg-gradient-to-br from-[#00a090] to-[#006558] px-6 pt-6 pb-8">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-8 w-16 h-16 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />

          <div className="relative flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5 text-white" />
            </div>
            <DialogHeader className="space-y-0.5 text-left p-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">
                Atur Stok
              </DialogTitle>
              <p className="text-white/65 text-xs font-normal truncate max-w-[260px]">
                {variantName}
              </p>
            </DialogHeader>
          </div>

          {/* Current stock badge */}
          <div className="relative mt-4 inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-3 py-2">
            <Package className="w-3.5 h-3.5 text-white/70" />
            <span className="text-white/70 text-[11px] font-medium">Stok Saat Ini</span>
            <span className="text-white text-base font-bold ml-1">{currentStock.toLocaleString('id-ID')}</span>
            <span className="text-white/50 text-[11px]">unit</span>
          </div>
        </div>

        {/* Form body */}
        <form action={handleSubmit}>
          <input type="hidden" name="variantId" value={variantId} />

          <div className="px-6 pt-5 pb-2 space-y-5">

            {/* Movement type selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Tipe Pergerakan <span className="text-red-400">*</span></p>
              <div className="grid grid-cols-3 gap-2">
                {MOVEMENT_TYPES.map(({ value, icon: Icon, label, sublabel, activeClass, dotClass, iconBg, iconClass }) => {
                  const isActive = movementType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMovementType(value)}
                      disabled={loading}
                      className={`relative flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-3 text-center transition-all duration-200 disabled:opacity-50 ${
                        isActive
                          ? activeClass
                          : 'border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isActive ? iconBg : 'bg-gray-100'}`}>
                        <Icon className={`w-4 h-4 ${isActive ? iconClass : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold leading-tight">{label}</p>
                        <p className="text-[10px] opacity-60 leading-tight mt-0.5">{sublabel}</p>
                      </div>
                      {isActive && (
                        <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${dotClass}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Quantity */}
            <div>
              <FieldLabel icon={Plus} label="Kuantitas" required />
              <Input
                id="quantity"
                name="quantity"
                type="tel"
                required
                value={quantity}
                onChange={(e) => handleNumberChange(e.target.value)}
                placeholder="0"
                disabled={loading}
                className="h-10 border-gray-200 focus-visible:ring-[#00a090]/30 focus-visible:border-[#00a090] transition-colors placeholder:text-gray-300 tabular-nums"
              />

              {/* Stock preview */}
              {parsedQty > 0 && movementType && previewStock !== null && (
                <div className={`mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium border ${
                  previewStock < 0
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : selectedType?.value === 'IN'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : selectedType?.value === 'OUT'
                    ? 'bg-orange-50 border-orange-200 text-orange-700'
                    : 'bg-[#00a090]/5 border-[#00a090]/20 text-[#00a090]'
                }`}>
                  <span>Stok setelah perubahan</span>
                  <span className="font-bold text-sm">
                    {previewStock < 0 ? '⚠ Tidak cukup' : `${previewStock.toLocaleString('id-ID')} unit`}
                  </span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <FieldLabel icon={FileText} label="Keterangan" hint="Opsional" />
              <Input
                id="reason"
                name="reason"
                placeholder="Contoh: Restock, Barang rusak, Opname..."
                disabled={loading}
                maxLength={100}
                className="h-10 border-gray-200 focus-visible:ring-[#00a090]/30 focus-visible:border-[#00a090] transition-colors placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 mt-2 border-t border-gray-100 bg-gray-50/50">
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
              disabled={loading || !movementType || !quantity}
              className="bg-[#00a090] hover:bg-[#007868] text-white shadow-sm min-w-[130px] transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menyimpan...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Perbarui Stok
                </span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}