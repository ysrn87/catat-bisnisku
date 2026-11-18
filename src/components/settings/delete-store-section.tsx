'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, ShieldAlert, Trash2, Type } from 'lucide-react';
import { createDeleteStoreChallengeAction, deleteStoreAction } from '@/actions/delete-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Props {
  storeId:     string;
  storeName:   string;
  isOwner:     boolean;
  isActivePro: boolean;
  stats:       { products: number; sales: number; staff: number };
}

// Sama dengan normalizePhrase() di server; hanya untuk mengaktifkan tombol (UX).
const normalize = (v: string) => v.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

export function DeleteStoreSection({ storeId, storeName, isOwner, isActivePro, stats }: Props) {
  const router = useRouter();

  const [open, setOpen]                 = useState(false);
  const [phrase, setPhrase]             = useState('');
  const [token, setToken]               = useState('');
  const [challengeLoading, setChLoading] = useState(false);
  const [typed, setTyped]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ack, setAck]                   = useState(false);
  const [loading, setLoading]           = useState(false);
  const [done, setDone]                 = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const loadChallenge = useCallback(async () => {
    setChLoading(true);
    const res = await createDeleteStoreChallengeAction(storeId);
    if (res.success) {
      setPhrase(res.phrase);
      setToken(res.token);
    } else {
      setError(res.error);
    }
    setChLoading(false);
  }, [storeId]);

  function resetForm() {
    setPhrase(''); setToken(''); setTyped(''); setPassword('');
    setShowPassword(false); setAck(false); setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (loading || done) return;
    setOpen(next);
    resetForm();
  }

  useEffect(() => {
    if (open) loadChallenge();
  }, [open, loadChallenge]);

  const phraseMatches = !!phrase && normalize(typed) === normalize(phrase);
  const canSubmit     = phraseMatches && password.length > 0 && ack && !loading && !challengeLoading;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.set('storeId', storeId);
    fd.set('token', token);
    fd.set('phrase', typed);
    fd.set('password', password);
    fd.set('acknowledge', ack ? 'yes' : 'no');

    const res = await deleteStoreAction(fd);
    if (res.success) {
      setDone(true);
      router.replace('/store-select');
      router.refresh();
      return;
    }

    setError(res.error);
    setPassword('');
    if (res.code === 'EXPIRED') {
      setTyped('');
      await loadChallenge();
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-red-200 bg-white">
      <div className="flex items-center gap-3 border-b border-red-100 bg-red-50/60 px-5 py-4 rounded-t-xl">
        <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
        <div>
          <h2 className="font-semibold text-red-700">Hapus Toko Permanen</h2>
          <p className="text-xs text-red-600/80">Tindakan ini tidak dapat dibatalkan.</p>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5 text-sm text-gray-700">
        <p>
          Menghapus <strong>{storeName}</strong> akan menghapus seluruh datanya dari sistem,
          dan tidak ada yang bisa dikembalikan, termasuk oleh kami.
        </p>

        <ul className="list-disc space-y-1 pl-5 text-gray-600">
          <li>{stats.products.toLocaleString('id-ID')} produk beserta varian dan kategori</li>
          <li>{stats.sales.toLocaleString('id-ID')} transaksi penjualan dan pembayarannya</li>
          <li>Riwayat stok, cashflow, akun, dan jurnal</li>
          <li>Pelanggan, member beserta poinnya, {stats.staff.toLocaleString('id-ID')} anggota staff, dan undangan</li>
          <li>Pengaturan toko, riwayat langganan, dan logo</li>
        </ul>

        <p className="text-xs text-gray-500">
          Akun login Anda, staff, dan member <strong>tidak dihapus</strong>. Hanya keterkaitan mereka dengan toko ini yang dihapus.
          Alamat toko (slug) tidak bisa dipakai ulang selama 30 hari.
        </p>

        {isActivePro && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Langganan PRO toko ini masih aktif. Menghapus toko tidak menghasilkan pengembalian dana.</p>
          </div>
        )}

        {!isOwner ? (
          <p className="rounded-lg bg-gray-50 p-3 text-gray-600">
            Hanya pemilik toko yang dapat menghapus toko ini.
          </p>
        ) : (
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4" /> Hapus Toko Ini
              </Button>
            </DialogTrigger>

            <DialogContent
              aria-describedby={undefined}
              className="sm:max-w-[460px] p-0 gap-0 overflow-hidden border-0 shadow-2xl max-h-[92vh] flex flex-col"
            >
              <div className="relative bg-gradient-to-br from-red-600 to-red-800 px-5 sm:px-6 pt-5 sm:pt-6 pb-5 shrink-0">
                <div className="relative flex items-center gap-3 pr-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <Trash2 className="h-5 w-5 text-white" />
                  </div>
                  <DialogHeader className="min-w-0 space-y-0.5 p-0 text-left">
                    <DialogTitle className="text-lg font-semibold leading-tight text-white">Hapus Toko Permanen</DialogTitle>
                    <p className="truncate text-xs font-normal text-white/70">{storeName}</p>
                  </DialogHeader>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 space-y-4 overflow-y-auto px-5 sm:px-6 pt-5 pb-3">
                  <div className="space-y-2">
                    <label htmlFor="confirm-phrase" className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      <Type className="h-3.5 w-3.5 text-gray-400" />
                      Ketik kalimat berikut untuk melanjutkan <span className="text-red-400">*</span>
                    </label>

                    <div className="flex min-h-[44px] items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-center">
                      {challengeLoading && !phrase ? (
                        <Loader2 className="h-4 w-4 animate-spin text-red-400" />
                      ) : (
                        <span className="select-none font-mono text-sm font-semibold tracking-wide text-red-700">{phrase}</span>
                      )}
                    </div>

                    <Input
                      id="confirm-phrase"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      disabled={loading || !phrase}
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Ketik kalimat di atas"
                      className="h-10 border-gray-200"
                    />
                    {typed && !phraseMatches && <p className="text-xs text-gray-400">Kalimat belum sama.</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="confirm-password" className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      <Lock className="h-3.5 w-3.5 text-gray-400" />
                      Password akun Anda <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        autoComplete="current-password"
                        className="h-10 border-gray-200 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-200 p-3 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                      disabled={loading}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
                    />
                    <span>Saya mengerti bahwa seluruh data toko ini akan dihapus permanen dan tidak dapat dikembalikan.</span>
                  </label>

                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
                  )}
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/50 px-5 sm:px-6 py-4">
                  <button
                    type="button"
                    onClick={() => handleOpenChange(false)}
                    disabled={loading}
                    className="py-2 pr-2 text-sm text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <Button type="submit" variant="destructive" disabled={!canSubmit} className="min-w-[150px]">
                    {loading || done ? (
                      <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Menghapus...</span>
                    ) : (
                      <span className="flex items-center gap-2"><Trash2 className="h-3.5 w-3.5" /> Hapus Permanen</span>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
