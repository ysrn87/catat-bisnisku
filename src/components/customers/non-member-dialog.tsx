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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { createNonMemberCustomerAction, updateNonMemberCustomerAction } from '@/actions/customers';
import { Loader2, MapPin, Pencil, Phone, UserPlus, Users } from 'lucide-react';

type CreateProps = {
  mode: 'create';
  customer?: never;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type EditProps = {
  mode: 'edit';
  customer: { id: string; name: string; phone: string; address: string | null };
  trigger?: React.ReactNode;
  open?: never;
  onOpenChange?: never;
};

type NonMemberDialogProps = CreateProps | EditProps;

export function NonMemberDialog({ mode, customer, trigger, open: controlledOpen, onOpenChange: onControlledOpenChange }: NonMemberDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(mode === 'edit' ? customer.name : '');
  const [phone, setPhone] = useState(mode === 'edit' ? customer.phone : '');
  const [address, setAddress] = useState(mode === 'edit' ? (customer.address ?? '') : '');
  const { toast } = useToast();

  const isCreate = mode === 'create';

  const toTitleCase = (val: string) => val.replace(/\b\w/g, (c) => c.toUpperCase());

  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onControlledOpenChange?.(v);
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      if (mode === 'edit') {
        setName(customer.name);
        setPhone(customer.phone);
        setAddress(customer.address ?? '');
      } else {
        setName('');
        setPhone('');
        setAddress('');
      }
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9+]/g, '');
    const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
    setPhone(formatted);
  };

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      const result = isCreate
        ? await createNonMemberCustomerAction(formData)
        : await updateNonMemberCustomerAction(customer!.id, formData);

      if (result.success) {
        toast({
          title: 'Berhasil!',
          description: isCreate
            ? 'Pelanggan berhasil ditambahkan.'
            : 'Data pelanggan berhasil diperbarui.',
        });
        setOpen(false);
      } else {
        toast({ title: 'Error', description: result.error || 'Gagal menyimpan data.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = isCreate ? (
    <Button className="bg-[#028697] hover:bg-[#027080] shadow-sm">
      <UserPlus className="w-4 h-4 mr-2" />
      Tambah Pelanggan
    </Button>
  ) : (
    <Button variant="ghost" size="sm" title="Edit Pelanggan" className="group">
      <Pencil className="w-4 h-4 text-white group-hover:text-slate-900 transition-colors" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>

      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[440px] p-0 gap-0 overflow-hidden border-0 shadow-2xl"
      >
        {/* Header band */}
        <div className="relative bg-gradient-to-br from-[#028697] to-[#016d7a] px-6 pt-6 pb-8">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-8 w-16 h-16 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />

          <div className="relative flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <DialogHeader className="space-y-0.5 text-left p-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">
                {isCreate ? 'Tambah Pelanggan' : 'Edit Pelanggan'}
              </DialogTitle>
              <p className="text-white/65 text-xs font-normal">
                {isCreate
                  ? 'Daftarkan pelanggan baru tanpa keanggotaan'
                  : `Mengedit: ${customer?.name}`}
              </p>
            </DialogHeader>
          </div>
        </div>

        {/* Form body */}
        <form action={handleSubmit}>
          <div className="px-6 pt-6 pb-2 space-y-4">

            {/* Nama */}
            <div className="space-y-1.5">
              <label
                htmlFor="nm-name"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest"
              >
                <Users className="w-3 h-3" />
                Nama Lengkap <span className="text-red-400">*</span>
              </label>
              <Input
                id="nm-name"
                name="name"
                value={name}
                onChange={(e) => setName(toTitleCase(e.target.value))}
                required
                disabled={loading}
                maxLength={80}
                placeholder="Nama Lengkap"
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
              />
            </div>

            {/* Telepon */}
            <div className="space-y-1.5">
              <label
                htmlFor="nm-phone"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest"
              >
                <Phone className="w-3 h-3" />
                Telepon / WA <span className="text-red-400">*</span>
              </label>
              <Input
                id="nm-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                onKeyDown={(e) => {
                  const controlKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
                  if (!controlKeys.includes(e.key) && !/^[0-9+]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                  }
                }}
                inputMode="tel"
                required
                disabled={loading}
                minLength={9}
                maxLength={19}
                placeholder="0812 3456 7890"
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
              />
            </div>

            {/* Alamat */}
            <div className="space-y-1.5">
              <label
                htmlFor="nm-address"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest"
              >
                <MapPin className="w-3 h-3" />
                Alamat <span className="text-red-400">*</span>
              </label>
              <Textarea
                id="nm-address"
                name="address"
                value={address}
                onChange={(e) => setAddress(toTitleCase(e.target.value))}
                required
                disabled={loading}
                maxLength={250}
                placeholder="Nama Jalan, Kota, Kode Pos"
                className="resize-none border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
                rows={3}
              />
              <p className="text-[11px] text-gray-300 text-right">{address.length}/250</p>
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
                  <UserPlus className="w-3.5 h-3.5" />
                  Tambah Pelanggan
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