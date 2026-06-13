'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { createCustomerAction, updateCustomerAction } from '@/actions/members';
import { Textarea } from '../ui/textarea';
import {
  Plus,
  Pencil,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ImageIcon,
  Lock,
  Star,
  AlertTriangle,
  Loader2,
  UserPlus,
} from 'lucide-react';

interface CustomerDialogProps {
  mode: 'create' | 'edit';
  customer?: {
    id: string;
    name: string;
    email?: string;
    phone: string;
    address?: string;
    birthday?: Date;
    photoUrl?: string;
    points: number;
  };
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

export function CustomerDialog({ mode, customer, trigger, onSuccess, open: controlledOpen, onOpenChange: onControlledOpenChange }: CustomerDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onControlledOpenChange?.(v);
  };
  const [loading, setLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(customer?.photoUrl || '');
  const [points, setPoints] = useState(customer?.points || 0);
  const [initialPoints] = useState(customer?.points || 0);
  const { toast } = useToast();

  const isCreate = mode === 'create';

  const [name, setName] = useState(isCreate ? '' : (customer?.name || ''));
  const [phone, setPhone] = useState(isCreate ? '' : (customer?.phone || ''));
  const [address, setAddress] = useState(isCreate ? '' : (customer?.address || ''));
  const [emailError, setEmailError] = useState('');

  const toTitleCase = (val: string) => val.replace(/\b\w/g, (c) => c.toUpperCase());

  useEffect(() => {
    if (open) {
      setPhotoUrl(customer?.photoUrl || '');
      setPoints(customer?.points || 0);
      setName(isCreate ? '' : (customer?.name || ''));
      setPhone(isCreate ? '' : (customer?.phone || ''));
      setAddress(isCreate ? '' : (customer?.address || ''));
      setEmailError('');
    }
  }, [open]);

  const pointsChanged = mode === 'edit' && points !== initialPoints;

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
    if (mode === 'edit' && pointsChanged) {
      const pointsReason = formData.get('pointsReason') as string;
      if (!pointsReason || pointsReason.trim() === '') {
        toast({
          title: 'Terjadi kesalahan',
          description: 'Masukkan keterangan perubahan poin.',
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);
    try {
      const result = isCreate
        ? await createCustomerAction(formData)
        : await updateCustomerAction(customer!.id, formData);

      if (result.success) {
        toast({
          title: isCreate ? 'Member berhasil didaftarkan!' : 'Data member diperbarui!',
          description: isCreate
            ? 'Member baru sudah terdaftar di sistem.'
            : 'Perubahan berhasil disimpan.',
        });
        setOpen(false);
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: 'Terjadi kesalahan',
          description: result.error || `Gagal ${isCreate ? 'mendaftarkan' : 'memperbarui'} member.`,
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant={isCreate ? 'default' : 'ghost'}
            size={isCreate ? 'default' : 'sm'}
            className={isCreate ? 'bg-[#028697] hover:bg-[#027080] shadow-sm' : 'group'}
          >
            {isCreate ? (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Tambah Member
              </>
            ) : (
              <Pencil className="w-4 h-4 text-white group-hover:text-slate-900 transition-colors" />
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[500px] p-0 gap-0 overflow-hidden border-0 shadow-2xl"
      >
        {/* Header band */}
        <div className="relative bg-gradient-to-br from-[#028697] to-[#016d7a] px-6 pt-6 pb-8">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-8 w-16 h-16 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />

          <div className="relative flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              {isCreate ? (
                <UserPlus className="w-5 h-5 text-white" />
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>
            <DialogHeader className="space-y-0.5 text-left p-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">
                {isCreate ? 'Tambah Member' : 'Edit Member'}
              </DialogTitle>
              <p className="text-white/65 text-xs font-normal">
                {isCreate
                  ? 'Daftarkan member baru ke sistem'
                  : `Mengedit: ${customer?.name}`}
              </p>
            </DialogHeader>
          </div>
        </div>

        {/* Scrollable form body */}
        <form action={handleSubmit}>
          <div className="overflow-y-auto max-h-[60vh] px-6 pt-5 pb-2 space-y-4">

            <SectionDivider label="Info Dasar" />

            {/* Nama */}
            <div>
              <FieldLabel icon={User} label="Nama Lengkap" required />
              <Input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(toTitleCase(e.target.value))}
                placeholder="Nama Lengkap"
                disabled={loading}
                maxLength={80}
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
              />
            </div>

            {/* Telepon */}
            <div>
              <FieldLabel icon={Phone} label="No. WhatsApp" required />
              <Input
                id="phone"
                name="phone"
                type="tel"
                onChange={handlePhoneChange}
                onKeyDown={(e) => {
                  const ctrl = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
                  if (!ctrl.includes(e.key) && !/^[0-9+]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
                }}
                minLength={9}
                maxLength={19}
                inputMode="tel"
                required
                value={phone}
                placeholder="0812 3456 7890"
                disabled={loading}
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
              />
            </div>

            {/* Email */}
            <div>
              <FieldLabel icon={Mail} label="Email" hint="Opsional" />
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={customer?.email}
                placeholder="contoh@email.com"
                onChange={handleEmailChange}
                pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                disabled={loading}
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
              />
              {emailError && <p className="text-[11px] text-red-500 mt-1">{emailError}</p>}
            </div>

            <SectionDivider label="Alamat" />

            {/* Alamat */}
            <div>
              <FieldLabel icon={MapPin} label="Alamat" required />
              <Textarea
                id="address"
                name="address"
                value={address}
                placeholder="Nama Jalan, Kota, Kode Pos"
                onChange={(e) => setAddress(toTitleCase(e.target.value))}
                disabled={loading}
                required
                maxLength={250}
                rows={3}
                className="resize-none border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
              />
              <p className="text-[11px] text-gray-300 text-right mt-1">{address.length}/250</p>
            </div>

            <SectionDivider label="Profil" />

            {/* Tanggal Lahir */}
            <div>
              <FieldLabel icon={Calendar} label="Tanggal Lahir" hint="Opsional" />
              <Input
                id="birthday"
                name="birthday"
                type="date"
                max={new Date().toISOString().split('T')[0]}
                defaultValue={customer?.birthday ? new Date(customer.birthday).toISOString().split('T')[0] : ''}
                disabled={loading}
                className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors"
              />
            </div>

            {/* Photo URL */}
            <div>
              <FieldLabel icon={ImageIcon} label="Photo URL" hint="Opsional" />
              <div className="flex gap-3 items-center">
                <Avatar className="w-10 h-10 flex-shrink-0 border-2 border-gray-100">
                  <AvatarImage src={photoUrl || undefined} alt="Preview" className="object-cover object-center" />
                  <AvatarFallback className="bg-gradient-to-br from-[#028697] to-[#016d7a] text-white text-xs">
                    {name?.slice(0, 2).toUpperCase() || customer?.name?.slice(0, 2).toUpperCase() || 'MR'}
                  </AvatarFallback>
                </Avatar>
                <Input
                  id="photoUrl"
                  name="photoUrl"
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  disabled={loading}
                  className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
                />
              </div>
            </div>

            <SectionDivider label="Keamanan" />

            {/* Password */}
            {isCreate ? (
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
              </div>
            ) : (
              <div>
                <FieldLabel icon={Lock} label="Ubah Password" hint="Opsional" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Biarkan kosong untuk tidak diubah"
                  minLength={6}
                  disabled={loading}
                  className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
                />
                <p className="text-[11px] text-gray-400 mt-1">Min. 6 karakter</p>
              </div>
            )}

            {/* Points — edit only */}
            {mode === 'edit' && (
              <>
                <SectionDivider label="Poin Loyalitas" />

                <div>
                  <FieldLabel icon={Star} label="Jumlah Poin" />
                  <Input
                    id="points"
                    name="points"
                    type="number"
                    min="0"
                    value={points}
                    onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                    disabled={loading}
                    className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Saat ini: {initialPoints} poin</p>
                </div>

                {pointsChanged && (
                  <div>
                    <FieldLabel
                      icon={AlertTriangle}
                      label="Keterangan Perubahan Poin"
                      required
                    />
                    <Input
                      id="pointsReason"
                      name="pointsReason"
                      type="text"
                      required
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
              </>
            )}

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
                  Daftar Member
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