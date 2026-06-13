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
import { upgradeToMemberAction } from '@/actions/customers';
import {
  UserCog,
  User,
  Phone,
  MapPin,
  Lock,
  Mail,
  Calendar,
  ImageIcon,
  Loader2,
  CheckCircle2,
  Star,
} from 'lucide-react';

interface UpgradeToMemberDialogProps {
  customer: {
    id: string;
    name: string;
    phone: string;
    address: string | null;
  };
}

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

export function UpgradeToMemberDialog({ customer }: UpgradeToMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [address, setAddress] = useState(customer.address ?? '');
  const { toast } = useToast();

  const toTitleCase = (val: string) => val.replace(/\b\w/g, (c) => c.toUpperCase());

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setName(customer.name);
      setPhone(customer.phone);
      setAddress(customer.address ?? '');
      setEmailError('');
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9+]/g, '');
    const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
    setPhone(formatted);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    setEmailError(val && !valid ? 'Masukkan alamat email yang valid' : '');
  };

  const handleSubmit = async (formData: FormData) => {
    const email = formData.get('email') as string;
    if (email && emailError) {
      toast({ title: 'Error', description: 'Masukkan alamat email yang valid.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const result = await upgradeToMemberAction(customer.id, formData);
      if (result.success) {
        toast({ title: 'Berhasil diupgrade!', description: `${name} sekarang menjadi member.` });
        setOpen(false);
        window.location.reload();
      } else {
        toast({ title: 'Terjadi kesalahan', description: result.error || 'Gagal upgrade pelanggan.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Terjadi kesalahan', description: 'Permintaan tidak dapat diproses.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Upgrade to Member" className="group">
          <UserCog className="w-4 h-4 text-white group-hover:text-slate-900 transition-colors" />
        </Button>
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
              <UserCog className="w-5 h-5 text-white" />
            </div>
            <DialogHeader className="space-y-0.5 text-left p-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">
                Upgrade ke Member
              </DialogTitle>
              <p className="text-white/65 text-xs font-normal">
                Mengedit &amp; upgrade: {customer.name}
              </p>
            </DialogHeader>
          </div>

          {/* Benefits pills */}
          <div className="relative mt-4 flex flex-wrap gap-2">
            {[
              { icon: Star, label: 'Kumpulkan poin reward' },
              { icon: CheckCircle2, label: 'Akses portal member' },
              { icon: CheckCircle2, label: 'Riwayat tersimpan' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-2.5 py-1"
              >
                <Icon className="w-3 h-3 text-white/80" />
                <span className="text-white/80 text-[10px] font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form body */}
        <form action={handleSubmit}>
          <div className="overflow-y-auto max-h-[58vh] px-6 pt-5 pb-2 space-y-4">

            <SectionDivider label="Info Pelanggan" />

            <div>
              <FieldLabel icon={User} label="Nama Lengkap" required />
              <Input
                id="name"
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

            <div>
              <FieldLabel icon={Phone} label="Telepon / WA" required />
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                onKeyDown={(e) => {
                  const ctrl = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
                  if (!ctrl.includes(e.key) && !/^[0-9+]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
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

            <div>
              <FieldLabel icon={MapPin} label="Alamat" required />
              <Textarea
                id="address"
                name="address"
                value={address}
                onChange={(e) => setAddress(toTitleCase(e.target.value))}
                required
                disabled={loading}
                maxLength={250}
                placeholder="Nama Jalan, Kota, Kode Pos"
                rows={3}
                className="resize-none border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
              />
              <p className="text-[11px] text-gray-300 text-right mt-1">{address.length}/250</p>
            </div>

            <SectionDivider label="Akun Member" />

            <div>
              <FieldLabel icon={Mail} label="Email" required />
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="contoh@email.com"
                onChange={handleEmailChange}
                pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                disabled={loading}
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
              />
              {emailError && <p className="text-[11px] text-red-500 mt-1">{emailError}</p>}
            </div>

            <div>
              <FieldLabel icon={Lock} label="Password" required />
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="Min. 6 karakter"
                minLength={6}
                disabled={loading}
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
              />
              <p className="text-[11px] text-gray-400 mt-1">Akan digunakan untuk login member</p>
            </div>

            <SectionDivider label="Profil" />

            <div>
              <FieldLabel icon={Calendar} label="Tanggal Lahir" hint="Opsional" />
              <Input
                id="birthday"
                name="birthday"
                type="date"
                max={new Date().toISOString().split('T')[0]}
                disabled={loading}
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors"
              />
            </div>

            <div>
              <FieldLabel icon={ImageIcon} label="Photo URL" hint="Opsional" />
              <Input
                id="photoUrl"
                name="photoUrl"
                type="url"
                placeholder="https://example.com/photo.jpg"
                disabled={loading}
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
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
              disabled={loading}
              className="bg-[#028697] hover:bg-[#027080] text-white shadow-sm min-w-[150px] transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserCog className="w-3.5 h-3.5" />
                  Upgrade ke Member
                </span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}