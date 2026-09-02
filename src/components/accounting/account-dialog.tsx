'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { createAccountAction, updateAccountAction } from '@/actions/accounts';
import { BookOpen, Loader2, Pencil, Plus, Lock } from 'lucide-react';

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

const ACCOUNT_TYPES: { value: AccountType; label: string; sub: string; prefix: string; color: string }[] = [
  { value: 'ASSET',     label: 'Aset',        sub: 'Asset',      prefix: '1xxx', color: 'text-blue-700 bg-blue-50 border-blue-200'    },
  { value: 'LIABILITY', label: 'Liabilitas',  sub: 'Liability',  prefix: '2xxx', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  { value: 'EQUITY',    label: 'Ekuitas',     sub: 'Equity',     prefix: '3xxx', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { value: 'REVENUE',   label: 'Pendapatan',  sub: 'Revenue',    prefix: '4xxx', color: 'text-green-700 bg-green-50 border-green-200'   },
  { value: 'EXPENSE',   label: 'Beban',       sub: 'Expense',    prefix: '5xxx', color: 'text-red-700 bg-red-50 border-red-200'         },
];

interface AccountDialogProps {
  mode?:    'create' | 'edit';
  account?: {
    id:       string;
    code:     string;
    name:     string;
    type:     AccountType;
    isSystem: boolean;
  };
  trigger?: React.ReactNode;
}

export function AccountDialog({ mode = 'create', account, trigger }: AccountDialogProps) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [type,    setType]    = useState<AccountType>(account?.type ?? 'EXPENSE');
  const { toast } = useToast();

  const isCreate  = mode === 'create';
  const isSystem  = !isCreate && account?.isSystem;

  const selectedType = ACCOUNT_TYPES.find(t => t.value === type)!;

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) setType(account?.type ?? 'EXPENSE');
  };

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      // System accounts: override type/code dengan nilai lama
      if (isSystem && account) {
        formData.set('code', account.code);
        formData.set('type', account.type);
      } else {
        formData.set('type', type);
      }

      const result = isCreate
        ? await createAccountAction(formData)
        : await updateAccountAction(account!.id, formData);

      if (result.success) {
        toast({
          title:       'Berhasil!',
          description: isCreate ? 'Akun berhasil ditambahkan.' : 'Akun berhasil diperbarui.',
        });
        setOpen(false);
      } else {
        toast({ title: 'Gagal', description: (result as any).error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Permintaan tidak dapat diproses.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger
        ? <div onClick={() => setOpen(true)}>{trigger}</div>
        : (
          <DialogTrigger asChild>
            <Button
              variant={isCreate ? 'default' : 'ghost'}
              size={isCreate ? 'default' : 'sm'}
              className={isCreate ? 'bg-[#028697] hover:bg-[#017585] shadow-sm' : ''}
            >
              {isCreate
                ? <><Plus className="w-4 h-4 mr-2" />Tambah Akun</>
                : <Pencil className="w-4 h-4" />
              }
            </Button>
          </DialogTrigger>
        )
      }

      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[440px] p-0 gap-0 overflow-hidden border-0 shadow-2xl"
      >
        {/* Header — gradient sesuai tipe akun */}
        <div className="relative bg-gradient-to-br from-[#028697] to-[#015561] px-6 pt-6 pb-8">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-8 w-16 h-16 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              {isSystem ? <Lock className="w-5 h-5 text-white" /> : <BookOpen className="w-5 h-5 text-white" />}
            </div>
            <DialogHeader className="space-y-0.5 text-left p-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">
                {isCreate ? 'Tambah Akun Baru' : isSystem ? 'Detail Akun Sistem' : 'Edit Akun'}
              </DialogTitle>
              <p className="text-white/65 text-xs font-normal">
                {isCreate
                  ? 'Tambah akun ke Chart of Accounts toko'
                  : isSystem
                    ? 'Akun sistem — hanya nama yang dapat diubah'
                    : `Mengedit: ${account?.code} · ${account?.name}`
                }
              </p>
            </DialogHeader>
          </div>
        </div>

        {/* System account notice */}
        {isSystem && (
          <div className="mx-6 mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Akun sistem tidak dapat diganti kode atau tipenya karena digunakan oleh engine jurnal otomatis.
              Hanya nama tampilan yang dapat diubah.
            </p>
          </div>
        )}

        {/* Form */}
        <form action={handleSubmit}>
          <div className="px-6 pt-5 pb-2 space-y-4">

            {/* Tipe Akun */}
            {!isSystem && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                  Tipe Akun <span className="text-red-400">*</span>
                </p>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as AccountType)}
                  disabled={loading}
                >
                  <SelectTrigger className="h-9 text-sm border-gray-200 focus:ring-[#028697]/30 focus:border-[#028697]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-sm">
                        <span className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${t.color}`}>
                            {t.prefix}
                          </span>
                          {t.label}
                          <span className="text-gray-400 text-xs">({t.sub})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Kode Akun */}
            <div className="space-y-1.5">
              <label htmlFor="code" className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                Kode Akun
                {!isSystem && <span className="text-red-400">*</span>}
                {!isSystem && (
                  <span className="ml-auto font-normal normal-case tracking-normal text-gray-400 text-[11px]">
                    Harus diawali {selectedType.prefix[0]}
                    <span className={`ml-1 text-[10px] px-1 rounded border font-mono ${selectedType.color}`}>
                      {selectedType.prefix}
                    </span>
                  </span>
                )}
              </label>
              <Input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                maxLength={4}
                required={!isSystem}
                defaultValue={account?.code}
                disabled={loading || !!isSystem}
                placeholder={`${selectedType.prefix[0]}001`}
                className="h-9 text-sm font-mono border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] placeholder:text-gray-300 placeholder:font-sans disabled:opacity-60 disabled:bg-gray-50"
              />
            </div>

            {/* Nama Akun */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                Nama Akun <span className="text-red-400">*</span>
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                maxLength={100}
                defaultValue={account?.name}
                disabled={loading}
                placeholder="Contoh: Kas, Beban Listrik, Utang Dagang..."
                className="h-9 text-sm border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] placeholder:text-gray-300"
              />
            </div>

            {/* Hint kode */}
            {!isSystem && (
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-[11px] text-gray-500 space-y-0.5">
                <p className="font-medium text-gray-600">Konvensi penomoran akun:</p>
                {ACCOUNT_TYPES.map(t => (
                  <p key={t.value}>
                    <span className={`font-mono text-[10px] px-1 rounded border ${t.color}`}>{t.prefix}</span>
                    {' '}→ {t.label} ({t.sub})
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 mt-4">
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
              className="bg-[#028697] hover:bg-[#017585] text-white shadow-sm min-w-[130px]"
            >
              {loading
                ? <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Menyimpan...</span>
                : isCreate ? <span className="flex items-center gap-2"><Plus className="w-3.5 h-3.5" />Tambah Akun</span>
                : 'Simpan Perubahan'
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
