'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { updateCustomerAction } from '@/actions/members';
import {
  User, Phone, Mail, Calendar, ImageIcon,
  Lock, Star, AlertTriangle, Loader2,
} from 'lucide-react';

interface EditMemberDialogProps {
  customer: {
    id: string;
    name: string;
    email?: string | null;
    phone: string;
    birthday?: Date | null;
    photoUrl?: string | null;
    points: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FieldLabel({ icon: Icon, label, required, hint }: {
  icon?: React.ElementType; label: string; required?: boolean; hint?: string;
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

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 border-t border-gray-100" />
    </div>
  );
}

export function EditMemberDialog({ customer, open, onOpenChange }: EditMemberDialogProps) {
  const [loading, setLoading]       = useState(false);
  const [name, setName]             = useState(customer.name);
  const [phone, setPhone]           = useState(customer.phone);
  const [photoUrl, setPhotoUrl]     = useState(customer.photoUrl || '');
  const [points, setPoints]         = useState(customer.points);
  const [initialPoints]             = useState(customer.points);
  const [emailError, setEmailError] = useState('');
  const { toast } = useToast();

  // Reset setiap kali dialog dibuka
  useEffect(() => {
    if (open) {
      setName(customer.name);
      setPhone(customer.phone);
      setPhotoUrl(customer.photoUrl || '');
      setPoints(customer.points);
      setEmailError('');
    }
  }, [open]);

  const pointsChanged = points !== initialPoints;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw       = e.target.value.replace(/[^0-9+]/g, '');
    const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
    setPhone(formatted);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val   = e.target.value;
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    setEmailError(val && !valid ? 'Masukkan alamat email yang valid' : '');
  };

  const toTitleCase = (val: string) =>
    val.replace(/\b\w/g, (c) => c.toUpperCase());

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (pointsChanged) {
      const reason = formData.get('pointsReason') as string;
      if (!reason?.trim()) {
        toast({
          title: 'Keterangan wajib diisi',
          description: 'Masukkan alasan perubahan poin.',
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);
    try {
      const result = await updateCustomerAction(customer.id, formData);
      if (result.success) {
        toast({ title: 'Data member diperbarui!' });
        onOpenChange(false);
      } else {
        toast({
          title: 'Gagal menyimpan',
          description: result.error ?? 'Terjadi kesalahan.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Gagal menyimpan',
        description: 'Permintaan tidak dapat diproses.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[440px] p-0 gap-0 overflow-hidden border-0 shadow-2xl max-h-[90dvh] flex flex-col"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#028697] to-[#016d7a] px-6 pt-6 pb-8 flex-shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <DialogHeader className="space-y-0.5 text-left p-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">
                Edit Member
              </DialogTitle>
              <p className="text-white/65 text-xs font-normal">{customer.name}</p>
            </DialogHeader>
          </div>
        </div>

        {/* Body — scrollable */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

            {/* Nama */}
            <div>
              <FieldLabel icon={User} label="Nama" required />
              <Input
                name="name" required
                value={name}
                onChange={(e) => setName(toTitleCase(e.target.value))}
                disabled={loading}
                placeholder="Nama lengkap"
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors"
              />
            </div>

            {/* Nomor HP */}
            <div>
              <FieldLabel icon={Phone} label="Nomor HP" required />
              <Input
                name="phone" required
                value={phone}
                onChange={handlePhoneChange}
                onKeyDown={(e) => {
                  const ok = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End'];
                  if (!ok.includes(e.key) && !/^[0-9+]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                  }
                }}
                inputMode="tel"
                placeholder="0812 3456 7890"
                disabled={loading}
                maxLength={19}
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <FieldLabel icon={Mail} label="Email" hint="Opsional" />
              <Input
                name="email" type="email"
                defaultValue={customer.email ?? ''}
                placeholder="contoh@email.com"
                onChange={handleEmailChange}
                disabled={loading}
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
              />
              {emailError && <p className="text-[11px] text-red-500 mt-1">{emailError}</p>}
            </div>

            <SectionDivider label="Profil" />

            {/* Birthday */}
            <div>
              <FieldLabel icon={Calendar} label="Tanggal Lahir" hint="Opsional" />
              <Input
                name="birthday" type="date"
                max={new Date().toISOString().split('T')[0]}
                defaultValue={
                  customer.birthday
                    ? new Date(customer.birthday).toISOString().split('T')[0]
                    : ''
                }
                disabled={loading}
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors"
              />
            </div>

            {/* Photo URL */}
            <div>
              <FieldLabel icon={ImageIcon} label="Photo URL" hint="Opsional" />
              <div className="flex gap-3 items-center">
                <Avatar className="w-10 h-10 flex-shrink-0 border-2 border-gray-100">
                  <AvatarImage src={photoUrl || undefined} alt="Preview" className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-br from-[#028697] to-[#016d7a] text-white text-xs">
                    {name?.slice(0, 2).toUpperCase() || 'MB'}
                  </AvatarFallback>
                </Avatar>
                <Input
                  name="photoUrl" type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  disabled={loading}
                  className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
                />
              </div>
            </div>

            <SectionDivider label="Keamanan" />

            {/* Password — opsional saat edit */}
            <div>
              <FieldLabel icon={Lock} label="Ubah Password" hint="Opsional" />
              <Input
                name="password" type="password"
                placeholder="Biarkan kosong untuk tidak diubah"
                minLength={6}
                disabled={loading}
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
              />
              <p className="text-[11px] text-gray-400 mt-1">Min. 6 karakter</p>
            </div>

            <SectionDivider label="Poin Loyalitas" />

            {/* Poin */}
            <div>
              <FieldLabel icon={Star} label="Jumlah Poin" />
              <Input
                name="points" type="number" min="0"
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                disabled={loading}
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors"
              />
              <p className="text-[11px] text-gray-400 mt-1">Saat ini: {initialPoints} poin</p>
            </div>

            {/* Keterangan perubahan poin — muncul kalau poin berubah */}
            {pointsChanged && (
              <div>
                <FieldLabel icon={AlertTriangle} label="Keterangan Perubahan Poin" required />
                <Input
                  name="pointsReason" type="text" required
                  placeholder="Contoh: Koreksi kesalahan, Bonus promosi..."
                  disabled={loading}
                  className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  {points > initialPoints
                    ? `Menambah ${points - initialPoints} poin`
                    : `Mengurangi ${initialPoints - points} poin`}
                </p>
              </div>
            )}

            <div className="h-1" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <Button
              type="submit"
              disabled={loading || !!emailError}
              className="bg-[#028697] hover:bg-[#027080] text-white shadow-sm min-w-[140px] transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menyimpan...
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
