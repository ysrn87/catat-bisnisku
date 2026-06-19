'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { createCashflowAction, updateCashflowAction } from '@/actions/cashflow';
import {
  AlignLeft, CalendarDays, Loader2, Pencil, Plus, Tag,
  TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';

// Preset categories per transaction type
const INCOME_CATEGORIES  = ['Penjualan', 'Investasi', 'Pinjaman', 'Lainnya'];
const EXPENSE_CATEGORIES = ['Bahan Baku', 'Operasional', 'Gaji', 'Sewa', 'Utilitas', 'Marketing', 'Lainnya'];

interface CashflowDialogProps {
  mode?: 'create' | 'edit';
  transaction?: {
    id: string;
    type: 'INCOME' | 'EXPENSE';
    amount: number;
    category: string;
    description: string;
    date: Date;
  };
  /** Existing categories from DB for autocomplete */
  existingCategories?: string[];
  trigger?: React.ReactNode;
}

export function CashflowDialog({ mode = 'create', transaction, existingCategories = [], trigger }: CashflowDialogProps) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount]   = useState(transaction?.amount?.toString() || '');
  const [transactionType, setTransactionType] = useState<'INCOME' | 'EXPENSE'>(transaction?.type || 'INCOME');
  const [category, setCategory]     = useState(transaction?.category || '');
  const [customCategory, setCustomCategory] = useState('');
  const { toast } = useToast();

  const isCreate = mode === 'create';

  // Merge preset + existing DB categories, deduplicated
  const presetCats  = transactionType === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const allCats     = [...new Set([...presetCats, ...existingCategories])];
  const isCustom    = category === 'Lainnya' || (category && !allCats.includes(category));
  const effectiveCategory = isCustom && customCategory ? customCategory : category;

  const formatNumber = (value: string) => {
    const clean = value.replace(/[^\d.]/g, '');
    const parts = clean.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0];
  };
  const parseNumber = (value: string) => value.replace(/,/g, '');

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setAmount(transaction?.amount?.toString() || '');
      setTransactionType(transaction?.type || 'INCOME');
      setCategory(transaction?.category || '');
      setCustomCategory('');
    }
  };

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      const finalCategory = isCustom && customCategory ? customCategory : category;
      if (!finalCategory) {
        toast({ title: 'Pilih kategori', variant: 'destructive' });
        setLoading(false);
        return;
      }
      formData.set('amount', parseNumber(amount));
      formData.set('type', transactionType);
      formData.set('category', finalCategory);

      const result = isCreate
        ? await createCashflowAction(formData)
        : await updateCashflowAction(transaction!.id, formData);

      if (result.success) {
        toast({
          title: 'Berhasil!',
          description: isCreate ? 'Transaksi berhasil dicatat.' : 'Transaksi berhasil diperbarui.',
        });
        setOpen(false);
      } else {
        toast({ title: 'Terjadi kesalahan', description: result.error || 'Gagal menyimpan.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Terjadi kesalahan', description: 'Permintaan tidak dapat diproses.', variant: 'destructive' });
    } finally {
      setLoading(false);
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
            {isCreate ? <><Plus className="w-4 h-4 mr-2" />Tambah Transaksi</> : <Pencil className="w-4 h-4" />}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[480px] p-0 gap-0 overflow-hidden border-0 shadow-2xl max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#00a090] to-[#006558] px-6 pt-6 pb-8 shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-8 w-16 h-16 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <DialogHeader className="space-y-0.5 text-left p-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">
                {isCreate ? 'Pencatatan Arus Kas' : 'Edit Transaksi'}
              </DialogTitle>
              <p className="text-white/65 text-xs font-normal">
                {isCreate ? 'Catat pemasukan atau pengeluaran keuangan' : `Mengedit: ${transaction?.category}`}
              </p>
            </DialogHeader>
          </div>
        </div>

        {/* Form — scrollable */}
        <form action={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 pt-5 pb-2 space-y-4 overflow-y-auto flex-1">

            {/* Type selector */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Jenis Transaksi</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'INCOME'  as const, icon: TrendingUp,   label: 'Pemasukan',   sublabel: 'Income',     activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                  { value: 'EXPENSE' as const, icon: TrendingDown, label: 'Pengeluaran', sublabel: 'Expense',    activeClass: 'border-rose-500 bg-rose-50 text-rose-700' },
                ]).map(({ value, icon: Icon, label, sublabel, activeClass }) => {
                  const active = transactionType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setTransactionType(value); setCategory(''); setCustomCategory(''); }}
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

            {/* Jumlah */}
            <div className="space-y-1.5">
              <label htmlFor="amount" className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                <span className="font-mono text-[10px] border border-gray-300 rounded px-1 py-0.5 text-gray-400">Rp</span>
                Jumlah <span className="text-red-400">*</span>
              </label>
              <Input
                id="amount" name="amount" type="tel" required
                value={amount}
                onChange={(e) => setAmount(formatNumber(e.target.value))}
                placeholder="0"
                disabled={loading}
                className="h-9 text-sm font-mono tracking-wider border-gray-200 focus-visible:ring-[#00a090]/30 focus-visible:border-[#00a090] placeholder:text-gray-300 placeholder:font-sans placeholder:tracking-normal"
              />
            </div>

            {/* Kategori — chip selector */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                <Tag className="w-3 h-3" />
                Kategori <span className="text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {allCats.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    disabled={loading}
                    onClick={() => { setCategory(cat); if (cat !== 'Lainnya') setCustomCategory(''); }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                      category === cat
                        ? 'bg-[#00a090] border-[#00a090] text-white'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-gray-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {/* Custom input when "Lainnya" is selected */}
              {(category === 'Lainnya' || (category && !allCats.includes(category))) && (
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Tulis kategori kustom..."
                  disabled={loading}
                  maxLength={50}
                  className="h-9 text-sm mt-2 border-gray-200 focus-visible:ring-[#00a090]/30 focus-visible:border-[#00a090] placeholder:text-gray-300"
                />
              )}
              {/* Hidden input to submit effective category */}
              <input type="hidden" name="category" value={effectiveCategory} />
            </div>

            {/* Deskripsi */}
            <div className="space-y-1.5">
              <label htmlFor="description" className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                <AlignLeft className="w-3 h-3" />
                Deskripsi
                <span className="ml-auto font-normal normal-case tracking-normal text-gray-300 text-[11px]">Opsional</span>
              </label>
              <Input
                id="description" name="description"
                defaultValue={transaction?.description}
                placeholder="Keterangan singkat transaksi..."
                disabled={loading}
                className="h-9 text-sm border-gray-200 focus-visible:ring-[#00a090]/30 focus-visible:border-[#00a090] placeholder:text-gray-300"
              />
            </div>

            {/* Tanggal */}
            <div className="space-y-1.5">
              <label htmlFor="date" className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                <CalendarDays className="w-3 h-3" />
                Tanggal <span className="text-red-400">*</span>
              </label>
              <Input
                id="date" name="date" type="date" required
                defaultValue={
                  transaction?.date
                    ? new Date(transaction.date).toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0]
                }
                disabled={loading}
                className="h-9 text-sm border-gray-200 focus-visible:ring-[#00a090]/30 focus-visible:border-[#00a090]"
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
              className="bg-[#00a090] hover:bg-[#007868] text-white shadow-sm min-w-[130px] transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Menyimpan...</span>
              ) : isCreate ? (
                <span className="flex items-center gap-2"><Plus className="w-3.5 h-3.5" />Simpan Transaksi</span>
              ) : 'Simpan Perubahan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
