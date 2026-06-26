'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { checkPhoneExistsAction, createCustomerAction } from '@/actions/members';
import {
  Phone,
  Loader2,
  UserCheck,
  UserX,
  Link2,
  Copy,
  Check,
  Search,
} from 'lucide-react';

interface LinkMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeSlug?: string;
}

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'found'; name: string; alreadyMember: boolean }
  | { status: 'not_found' };

export function LinkMemberDialog({
  open,
  onOpenChange,
  storeSlug,
}: LinkMemberDialogProps) {
  const [phone, setPhone] = useState('');
  const [checkState, setCheckState] = useState<CheckState>({ status: 'idle' });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const registerUrl =
    typeof window !== 'undefined' && storeSlug
      ? `${window.location.origin}/register?slug=${storeSlug}`
      : storeSlug
        ? `/register?slug=${storeSlug}`
        : '/register';

  const handleClose = (v: boolean) => {
    if (!v) {
      setPhone('');
      setCheckState({ status: 'idle' });
      setLoading(false);
      setCopied(false);
    }
    onOpenChange(v);
  };

  const normalizePhone = (raw: string) =>
    raw.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9+]/g, '');
    const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
    setPhone(formatted);
    setCheckState({ status: 'idle' });

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const normalized = normalizePhone(raw);
    if (normalized.length >= 9) {
      setCheckState({ status: 'checking' });
      debounceRef.current = setTimeout(async () => {
        try {
          const result = await checkPhoneExistsAction(normalized);
          if (result.isAlreadyMember) {
            setCheckState({ status: 'found', name: result.name!, alreadyMember: true });
          } else if (result.exists) {
            setCheckState({ status: 'found', name: result.name!, alreadyMember: false });
          } else {
            setCheckState({ status: 'not_found' });
          }
        } catch {
          setCheckState({ status: 'idle' });
        }
      }, 700);
    }
  };

  const handleLink = async () => {
    if (checkState.status !== 'found' || checkState.alreadyMember) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set('phone', normalizePhone(phone));
      formData.set('linkExisting', 'true');
      formData.set('name', checkState.name);
      // password tidak diperlukan — user sudah punya akun sendiri
      const result = await createCustomerAction(formData);
      if (result.success) {
        toast({
          title: `${(result as any).name ?? checkState.name} berhasil dihubungkan!`,
          description: 'Akun member berhasil ditautkan ke toko ini.',
        });
        handleClose(false);
      } else {
        toast({
          title: 'Gagal menautkan',
          description: result.error ?? 'Terjadi kesalahan.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Gagal menautkan',
        description: 'Permintaan tidak dapat diproses.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(registerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard tidak tersedia */
    }
  };

  const isFound = checkState.status === 'found';
  const isAlreadyMember = isFound && checkState.alreadyMember;
  const canLink = isFound && !isAlreadyMember;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[420px] p-0 gap-0 overflow-hidden border-0 shadow-2xl"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#028697] to-[#016d7a] px-6 pt-6 pb-8">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-8 w-16 h-16 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <DialogHeader className="space-y-0.5 text-left p-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">
                Tautkan Akun Member
              </DialogTitle>
              <p className="text-white/65 text-xs font-normal">
                Cari akun yang sudah ada berdasarkan nomor HP
              </p>
            </DialogHeader>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pt-6 pb-2 space-y-5">

          {/* Phone input */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest">
              <Phone className="w-3 h-3" />
              Nomor HP / WA
            </label>
            <div className="relative">
              <Input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                onKeyDown={(e) => {
                  const ctrl = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
                  if (!ctrl.includes(e.key) && !/^[0-9+]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                  }
                }}
                inputMode="tel"
                placeholder="0812 3456 7890"
                disabled={loading}
                maxLength={19}
                autoFocus
                className="h-11 pr-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                {checkState.status === 'checking' && (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                )}
                {checkState.status === 'found' && !isAlreadyMember && (
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                )}
                {checkState.status === 'found' && isAlreadyMember && (
                  <UserCheck className="w-4 h-4 text-blue-500" />
                )}
                {checkState.status === 'not_found' && (
                  <UserX className="w-4 h-4 text-gray-400" />
                )}
                {checkState.status === 'idle' && phone.length > 0 && (
                  <Search className="w-4 h-4 text-gray-300" />
                )}
              </div>
            </div>
          </div>

          {/* ── Status: akun ditemukan, bisa ditautkan ── */}
          {checkState.status === 'found' && !isAlreadyMember && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mt-0.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    Akun ditemukan
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    <span className="font-medium">{checkState.name}</span> sudah punya akun.
                    Klik tombol di bawah untuk menautkan ke toko ini sebagai Member.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Status: sudah member di toko ini ── */}
          {checkState.status === 'found' && isAlreadyMember && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mt-0.5">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">
                    Sudah terdaftar
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    <span className="font-medium">{checkState.name}</span> sudah menjadi
                    member di toko ini.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Status: akun tidak ditemukan ── */}
          {checkState.status === 'not_found' && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mt-0.5">
                  <UserX className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Akun belum terdaftar
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Nomor ini belum punya akun. Minta pelanggan daftar sendiri
                    melalui link di bawah.
                  </p>
                </div>
              </div>

              {/* Register link */}
              <div className="flex items-center gap-2 bg-white rounded-lg border border-amber-200 px-3 py-2">
                <p className="text-[11px] text-gray-500 font-mono truncate flex-1 select-all">
                  {registerUrl}
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-900 transition-colors"
                >
                  {copied ? (
                    <><Check className="w-3 h-3" /> Disalin</>
                  ) : (
                    <><Copy className="w-3 h-3" /> Salin</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Spacer bawah */}
          <div className="h-1" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={() => handleClose(false)}
            disabled={loading}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <Button
            type="button"
            onClick={handleLink}
            disabled={!canLink || loading}
            className="bg-[#028697] hover:bg-[#027080] text-white shadow-sm min-w-[140px] transition-all disabled:opacity-40"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Menautkan...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5" />
                Tautkan ke Toko
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
