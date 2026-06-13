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
import { createCashflowAction, updateCashflowAction } from '@/actions/cashflow';
import {
  AlignLeft,
  CalendarDays,
  Loader2,
  Pencil,
  Plus,
  Tag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

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
  trigger?: React.ReactNode;
}

const TYPE_OPTIONS = [
  {
    value: 'INCOME' as const,
    icon: TrendingUp,
    label: 'Income',
    sublabel: 'Pemasukan',
    activeClass: 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-green-50 text-emerald-700',
    dotClass: 'bg-emerald-500',
    iconBg: 'bg-emerald-500',
  },
  {
    value: 'EXPENSE' as const,
    icon: TrendingDown,
    label: 'Spend',
    sublabel: 'Pengeluaran',
    activeClass: 'border-rose-500 bg-gradient-to-br from-rose-50 to-red-50 text-rose-700',
    dotClass: 'bg-rose-500',
    iconBg: 'bg-rose-500',
  },
];

export function CashflowDialog({ mode = 'create', transaction, trigger }: CashflowDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(transaction?.amount?.toString() || '');
  const [transactionType, setTransactionType] = useState<'INCOME' | 'EXPENSE'>(
    transaction?.type || 'INCOME'
  );
  const { toast } = useToast();

  const isCreate = mode === 'create';

  const formatNumber = (value: string): string => {
    const cleanValue = value.replace(/[^\d.]/g, '');
    const parts = cleanValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0];
  };

  const parseNumber = (value: string): string => value.replace(/,/g, '');

  const handleNumberChange = (value: string) => {
    setAmount(formatNumber(value));
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setAmount(transaction?.amount?.toString() || '');
      setTransactionType(transaction?.type || 'INCOME');
    }
  };

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      formData.set('amount', parseNumber(amount));
      formData.set('type', transactionType);

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
        toast({
          title: 'Terjadi kesalahan',
          description: result.error || 'Gagal menyimpan transaksi.',
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant={isCreate ? 'default' : 'ghost'}
            size={isCreate ? 'default' : 'sm'}
            className={isCreate ? 'bg-[#028697] hover:bg-[#027080] shadow-sm' : ''}
          >
            {isCreate ? (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Tambah Transaksi
              </>
            ) : (
              <Pencil className="w-4 h-4" />
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[480px] p-0 gap-0 overflow-hidden border-0 shadow-2xl"
      >
        {/* Header band */}
        <div className="relative bg-gradient-to-br from-[#028697] to-[#016d7a] px-6 pt-6 pb-8">
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
                {isCreate
                  ? 'Catat pemasukan atau pengeluaran keuangan'
                  : `Mengedit transaksi: ${transaction?.category}`}
              </p>
            </DialogHeader>
          </div>
        </div>

        {/* Form body */}
        <form action={handleSubmit}>
          <div className="px-6 pt-6 pb-2 space-y-5">

            {/* Transaction type selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                Jenis Transaksi
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {TYPE_OPTIONS.map(({ value, icon: Icon, label, sublabel, activeClass, dotClass, iconBg }) => {
                  const isActive = transactionType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTransactionType(value)}
                      disabled={loading}
                      className={`
                        relative flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left
                        transition-all duration-200 disabled:opacity-50
                        ${isActive
                          ? activeClass
                          : 'border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-200 hover:bg-gray-50'}
                      `}
                    >
                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded-sm flex items-center justify-center transition-colors
                          ${isActive ? iconBg : 'bg-gray-100'}`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-tight">{label}</p>
                        <p className="text-[10px] opacity-60 leading-tight mt-0.5">{sublabel}</p>
                      </div>
                      {isActive && (
                        <span className={`absolute top-1.5 left-1.5 w-2 h-2 rounded-full ${dotClass}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* Fields */}
            <div className="space-y-4">

              {/* Jumlah */}
              <div className="space-y-1.5">
                <label
                  htmlFor="amount"
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest"
                >
                  <span className="font-mono text-[10px] border border-gray-300 rounded px-1 py-0.5 text-gray-400">Rp</span>
                  Jumlah <span className="text-red-400">*</span>
                </label>
                <Input
                  id="amount"
                  name="amount"
                  type="tel"
                  required
                  value={amount}
                  onChange={(e) => handleNumberChange(e.target.value)}
                  placeholder="0"
                  disabled={loading}
                  className="h-10 font-mono tracking-wider border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300 placeholder:font-sans placeholder:tracking-normal"
                />
              </div>

              {/* Kategori */}
              <div className="space-y-1.5">
                <label
                  htmlFor="category"
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest"
                >
                  <Tag className="w-3 h-3" />
                  Kategori <span className="text-red-400">*</span>
                </label>
                <Input
                  id="category"
                  name="category"
                  required
                  defaultValue={transaction?.category}
                  placeholder="Penjualan, Sewa, Bahan Baku..."
                  disabled={loading}
                  className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
                />
              </div>

              {/* Deskripsi */}
              <div className="space-y-1.5">
                <label
                  htmlFor="description"
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest"
                >
                  <AlignLeft className="w-3 h-3" />
                  Deskripsi
                  <span className="ml-auto font-normal normal-case tracking-normal text-gray-300 text-[11px]">Opsional</span>
                </label>
                <Input
                  id="description"
                  name="description"
                  defaultValue={transaction?.description}
                  placeholder="Keterangan singkat transaksi..."
                  disabled={loading}
                  className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
                />
              </div>

              {/* Tanggal */}
              <div className="space-y-1.5">
                <label
                  htmlFor="date"
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest"
                >
                  <CalendarDays className="w-3 h-3" />
                  Tanggal <span className="text-red-400">*</span>
                </label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  required
                  defaultValue={
                    transaction?.date
                      ? new Date(transaction.date).toISOString().split('T')[0]
                      : new Date().toISOString().split('T')[0]
                  }
                  disabled={loading}
                  className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors"
                />
              </div>
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
              disabled={loading}
              className="bg-[#028697] hover:bg-[#027080] text-white shadow-sm min-w-[130px] transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menyimpan...
                </span>
              ) : isCreate ? (
                <span className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  Simpan Transaksi
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