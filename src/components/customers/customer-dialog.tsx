'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { createCustomerAction, updateCustomerAction } from '@/actions/members';
import { Textarea } from '../ui/textarea';
import {
  Plus, Pencil, User, Phone, Mail, MapPin, Calendar,
  ImageIcon, Lock, Star, AlertTriangle, Loader2, UserPlus,
  UserCheck, ArrowRight, X,
} from 'lucide-react';

interface CustomerDialogProps {
  mode: 'create' | 'edit';
  customer?: {
    id: string; name: string; email?: string; phone: string;
    address?: string; birthday?: Date; photoUrl?: string; points: number;
  };
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">{label}</span>
      <div className="flex-1 border-t border-gray-100" />
    </div>
  );
}

export function CustomerDialog({
  mode, customer, trigger, onSuccess,
  open: controlledOpen, onOpenChange: onControlledOpenChange,
}: CustomerDialogProps) {
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

  // ── State untuk deteksi user existing ────────────────────────────────────────
  const [existingUserName, setExistingUserName] = useState<string | null>(null);
  const [linkExisting, setLinkExisting] = useState(false);
  const [phoneChecking, setPhoneChecking] = useState(false);
  const phoneCheckTimeout = useRef<NodeJS.Timeout | null>(null);

  const toTitleCase = (val: string) => val.replace(/\b\w/g, (c) => c.toUpperCase());

  useEffect(() => {
    if (open) {
      setPhotoUrl(customer?.photoUrl || '');
      setPoints(customer?.points || 0);
      setName(isCreate ? '' : (customer?.name || ''));
      setPhone(isCreate ? '' : (customer?.phone || ''));
      setAddress(isCreate ? '' : (customer?.address || ''));
      setEmailError('');
      setExistingUserName(null);
      setLinkExisting(false);
    }
  }, [open]);

  const pointsChanged = mode === 'edit' && points !== initialPoints;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9+]/g, '');
    const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
    setPhone(formatted);
    setExistingUserName(null);
    setLinkExisting(false);

    // Cek phone setelah user berhenti mengetik 800ms
    if (isCreate) {
      if (phoneCheckTimeout.current) clearTimeout(phoneCheckTimeout.current);
      const normalized = raw.replace(/[^0-9+]/g, '');
      if (normalized.length >= 10) {
        setPhoneChecking(true);
        phoneCheckTimeout.current = setTimeout(async () => {
          try {
            const { checkPhoneExistsAction } = await import('@/actions/members');
            const result = await checkPhoneExistsAction(normalized);
            if (result.isAlreadyMember) {
              setExistingUserName(`already:${result.name}`);
            } else if (result.exists) {
              setExistingUserName(result.name ?? null);
            } else {
              setExistingUserName(null);
            }
          } catch { setExistingUserName(null); }
          finally { setPhoneChecking(false); }
        }, 800);
      } else {
        setPhoneChecking(false);
      }
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    setEmailError(val && !valid ? 'Masukkan alamat email yang valid' : '');
  };

  // User sudah terdaftar sebagai member di toko ini
  const isAlreadyMember = existingUserName?.startsWith('already:');
  // User sudah ada di sistem tapi belum di toko ini
  const isExistingElsewhere = existingUserName && !isAlreadyMember;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (mode === 'edit' && pointsChanged) {
      const pointsReason = formData.get('pointsReason') as string;
      if (!pointsReason || pointsReason.trim() === '') {
        toast({ title: 'Terjadi kesalahan', description: 'Masukkan keterangan perubahan poin.', variant: 'destructive' });
        return;
      }
    }

    // Kalau user existing dan belum konfirmasi
    if (isCreate && isExistingElsewhere && !linkExisting) {
      setLinkExisting(true);
      return;
    }

    if (linkExisting) formData.set('linkExisting', 'true');

    setLoading(true);
    try {
      const result = isCreate
        ? await createCustomerAction(formData)
        : await updateCustomerAction(customer!.id, formData);

      if (result.success) {
        const isLinked = (result as any).linked;
        const linkedName = (result as any).name;
        toast({
          title: isLinked
            ? `${linkedName} berhasil ditambahkan ke toko!`
            : isCreate ? 'Member berhasil didaftarkan!' : 'Data member diperbarui!',
          description: isLinked
            ? 'Member yang sudah ada di sistem berhasil dihubungkan ke toko ini.'
            : isCreate ? 'Member baru sudah terdaftar di sistem.' : 'Perubahan berhasil disimpan.',
        });
        setOpen(false);
        onSuccess?.();
      } else if ((result as any).requiresConfirmation) {
        // Harusnya sudah ditangani di UI, tapi fallback:
        setExistingUserName((result as any).existingName);
      } else {
        toast({ title: 'Terjadi kesalahan', description: result.error || 'Gagal memproses.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Terjadi kesalahan', description: 'Permintaan tidak dapat diproses.', variant: 'destructive' });
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
              <><Plus className="w-4 h-4 mr-2" />Tambah Member</>
            ) : (
              <Pencil className="w-4 h-4 text-white group-hover:text-slate-900 transition-colors" />
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent aria-describedby={undefined} className="sm:max-w-[500px] p-0 gap-0 overflow-hidden border-0 shadow-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#028697] to-[#016d7a] px-6 pt-6 pb-8">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-8 w-16 h-16 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              {isCreate ? <UserPlus className="w-5 h-5 text-white" /> : <User className="w-5 h-5 text-white" />}
            </div>
            <DialogHeader className="space-y-0.5 text-left p-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">
                {isCreate ? 'Tambah Member' : 'Edit Member'}
              </DialogTitle>
              <p className="text-white/65 text-xs font-normal">
                {isCreate ? 'Daftarkan member baru ke toko ini' : `Mengedit: ${customer?.name}`}
              </p>
            </DialogHeader>
          </div>
        </div>

        {/* ── Konfirmasi link user existing ── */}
        {isCreate && linkExisting && isExistingElsewhere && (
          <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-start gap-2">
              <UserCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Nomor ini terdaftar atas nama "{existingUserName}"
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Klik "Daftarkan ke Toko" untuk menambahkan member ini tanpa membuat akun baru.
                  Data profil (nama, alamat) tetap menggunakan data yang sudah ada.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => { setLinkExisting(false); setExistingUserName(null); }}
              >
                <X className="w-3.5 h-3.5 mr-1" /> Batal
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-white flex-1"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const formData = new FormData();
                    formData.set('phone', phone.replace(/\s/g, ''));
                    formData.set('linkExisting', 'true');
                    formData.set('name', existingUserName!);
                    formData.set('address', '-');
                    formData.set('password', 'placeholder');
                    const result = await createCustomerAction(formData);
                    if (result.success) {
                      toast({
                        title: `${(result as any).name} berhasil ditambahkan!`,
                        description: 'Member berhasil dihubungkan ke toko ini.',
                      });
                      setOpen(false);
                      onSuccess?.();
                    } else {
                      toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
                    }
                  } finally { setLoading(false); }
                }}
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <ArrowRight className="w-3.5 h-3.5 mr-1" />}
                Daftarkan ke Toko
              </Button>
            </div>
          </div>
        )}

        {/* Form — sembunyikan kalau sudah konfirmasi */}
        {!(isCreate && linkExisting) && (
          <form onSubmit={handleSubmit}>
            <div className="overflow-y-auto max-h-[60vh] px-6 pt-5 pb-2 space-y-4">
              <SectionDivider label="Info Dasar" />

              {/* Nama — hidden kalau link existing */}
              {!isExistingElsewhere && (
                <div>
                  <FieldLabel icon={User} label="Nama Lengkap" required />
                  <Input
                    name="name" type="text" required
                    value={name} onChange={(e) => setName(toTitleCase(e.target.value))}
                    placeholder="Nama Lengkap" disabled={loading} maxLength={80}
                    className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
                  />
                </div>
              )}

              {/* Telepon */}
              <div>
                <FieldLabel icon={Phone} label="No. WhatsApp" required />
                <div className="relative">
                  <Input
                    name="phone" type="tel" required
                    onChange={handlePhoneChange} value={phone}
                    minLength={9} maxLength={19} inputMode="tel"
                    placeholder="0812 3456 7890" disabled={loading}
                    className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300 pr-8"
                  />
                  {phoneChecking && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />
                  )}
                </div>

                {/* Status phone check */}
                {isCreate && isAlreadyMember && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {existingUserName?.replace('already:', '')} sudah menjadi member di toko ini
                  </p>
                )}
                {isCreate && isExistingElsewhere && !linkExisting && (
                  <div className="mt-1.5 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      Nomor ini sudah terdaftar atas nama "{existingUserName}"
                    </p>
                    <p className="text-[11px] text-amber-600 mt-0.5">
                      Submit form ini untuk menambahkan mereka ke toko ini, atau gunakan nomor berbeda untuk member baru.
                    </p>
                  </div>
                )}
              </div>

              {/* Sembunyikan field lain kalau user existing sudah terdeteksi */}
              {!isExistingElsewhere && (
                <>
                  {/* Email */}
                  <div>
                    <FieldLabel icon={Mail} label="Email" hint="Opsional" />
                    <Input
                      name="email" type="email"
                      defaultValue={customer?.email}
                      placeholder="contoh@email.com"
                      onChange={handleEmailChange}
                      disabled={loading}
                      className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
                    />
                    {emailError && <p className="text-[11px] text-red-500 mt-1">{emailError}</p>}
                  </div>

                  <SectionDivider label="Alamat" />
                  <div>
                    <FieldLabel icon={MapPin} label="Alamat" required />
                    <Textarea
                      name="address" value={address} required
                      placeholder="Nama Jalan, Kota, Kode Pos"
                      onChange={(e) => setAddress(toTitleCase(e.target.value))}
                      disabled={loading} maxLength={250} rows={3}
                      className="resize-none border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
                    />
                    <p className="text-[11px] text-gray-300 text-right mt-1">{address.length}/250</p>
                  </div>

                  <SectionDivider label="Profil" />
                  <div>
                    <FieldLabel icon={Calendar} label="Tanggal Lahir" hint="Opsional" />
                    <Input
                      name="birthday" type="date"
                      max={new Date().toISOString().split('T')[0]}
                      defaultValue={customer?.birthday ? new Date(customer.birthday).toISOString().split('T')[0] : ''}
                      disabled={loading}
                      className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors"
                    />
                  </div>
                  <div>
                    <FieldLabel icon={ImageIcon} label="Photo URL" hint="Opsional" />
                    <div className="flex gap-3 items-center">
                      <Avatar className="w-10 h-10 flex-shrink-0 border-2 border-gray-100">
                        <AvatarImage src={photoUrl || undefined} alt="Preview" className="object-cover object-center" />
                        <AvatarFallback className="bg-gradient-to-br from-[#028697] to-[#016d7a] text-white text-xs">
                          {name?.slice(0, 2).toUpperCase() || 'MR'}
                        </AvatarFallback>
                      </Avatar>
                      <Input
                        name="photoUrl" type="url" value={photoUrl}
                        onChange={(e) => setPhotoUrl(e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        disabled={loading}
                        className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
                      />
                    </div>
                  </div>

                  <SectionDivider label="Keamanan" />
                  {isCreate ? (
                    <div>
                      <FieldLabel icon={Lock} label="Password" required />
                      <Input
                        name="password" type="password" required
                        placeholder="Min. 6 karakter" minLength={6}
                        disabled={loading}
                        className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
                      />
                    </div>
                  ) : (
                    <div>
                      <FieldLabel icon={Lock} label="Ubah Password" hint="Opsional" />
                      <Input
                        name="password" type="password"
                        placeholder="Biarkan kosong untuk tidak diubah"
                        minLength={6} disabled={loading}
                        className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">Min. 6 karakter</p>
                    </div>
                  )}

                  {/* Poin — edit only */}
                  {mode === 'edit' && (
                    <>
                      <SectionDivider label="Poin Loyalitas" />
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
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 mt-2 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button" onClick={() => setOpen(false)} disabled={loading}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <Button
                type="submit"
                disabled={loading || isAlreadyMember as boolean}
                className="bg-[#028697] hover:bg-[#027080] text-white shadow-sm min-w-[130px] transition-all"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />Menyimpan...
                  </span>
                ) : isExistingElsewhere ? (
                  <span className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5" />Daftarkan ke Toko
                  </span>
                ) : isCreate ? (
                  <span className="flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" />Daftar Member
                  </span>
                ) : (
                  'Simpan Perubahan'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
