'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ImageIcon, Info, Landmark, Loader2, Pencil, Plus, QrCode, Upload, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  createPaymentAccountAction,
  deletePaymentAccountAction,
  getManagedPaymentAccounts,
  setPaymentAccountActiveAction,
  updatePaymentAccountAction,
} from '@/actions/payment-accounts';
import {
  BANK_SUGGESTIONS,
  EWALLET_SUGGESTIONS,
  MAX_ACCOUNTS_PER_TYPE,
  PAYMENT_ACCOUNT_TYPE_LABEL,
  QRIS_ALLOWED_MIME,
  QRIS_MAX_SIZE_BYTES,
  ewalletColor,
  isSafeBlobUrl,
  validatePaymentAccountInput,
  type PaymentAccountInfo,
  type PaymentAccountType,
} from '@/lib/payment-accounts';

const SECTIONS: Array<{
  type: PaymentAccountType;
  icon: typeof Landmark;
  description: string;
}> = [
  { type: 'BANK',    icon: Landmark, description: 'Tampil saat kasir memilih metode Transfer dan di invoice.' },
  { type: 'EWALLET', icon: Wallet,   description: 'Tampil saat kasir memilih metode E-Wallet dan di invoice.' },
  { type: 'QRIS',    icon: QrCode,   description: 'Tampil saat kasir memilih metode QRIS dan di invoice.' },
];

export function PaymentAccountsSettings({ initialAccounts }: { initialAccounts: PaymentAccountInfo[] }) {
  const [accounts, setAccounts] = useState<PaymentAccountInfo[]>(initialAccounts);
  const [form, setForm]         = useState<{ type: PaymentAccountType; account: PaymentAccountInfo | null } | null>(null);
  const [busyId, setBusyId]     = useState<string | null>(null);
  const { toast } = useToast();

  const reload = async () => {
    try {
      setAccounts(await getManagedPaymentAccounts());
    } catch {
      toast({ title: 'Gagal memuat ulang daftar', description: 'Muat ulang halaman.', variant: 'destructive' });
    }
  };

  const toggleActive = async (account: PaymentAccountInfo, next: boolean) => {
    setBusyId(account.id);
    try {
      const res = await setPaymentAccountActiveAction(account.id, next);
      if (!res.success) toast({ title: 'Gagal', description: res.error, variant: 'destructive' });
      await reload();
    } catch {
      toast({ title: 'Gagal mengubah status', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Informasi di sini dipakai di <strong>invoice</strong> dan di <strong>dialog pembayaran kasir</strong>: pelanggan
          yang memilih Transfer, E-Wallet, atau QRIS langsung melihat tujuan pembayarannya. Hanya akun yang
          <strong> aktif</strong> yang ditampilkan.
        </p>
      </div>

      {SECTIONS.map(({ type, icon: Icon, description }) => {
        const list   = accounts.filter((a) => a.type === type);
        const max    = MAX_ACCOUNTS_PER_TYPE[type];
        const atMax  = list.length >= max;

        return (
          <Card key={type}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-[#028697]" />
                  {PAYMENT_ACCOUNT_TYPE_LABEL[type]}
                </CardTitle>
                <CardDescription className="mt-1 text-xs">{description}</CardDescription>
              </div>
              <Button
                size="sm"
                disabled={atMax}
                title={atMax ? `Maksimal ${max} akun` : undefined}
                onClick={() => setForm({ type, account: null })}
                className="shrink-0 bg-[#028697] text-white hover:bg-[#017585]"
              >
                <Plus className="mr-1 h-4 w-4" /> Tambah
              </Button>
            </CardHeader>

            <CardContent className="space-y-2">
              {list.length === 0 && (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  Belum ada {PAYMENT_ACCOUNT_TYPE_LABEL[type].toLowerCase()}.
                </p>
              )}

              {list.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${a.isActive ? 'bg-background' : 'bg-muted/40 opacity-70'}`}
                >
                  <div className="min-w-0 flex-1">
                    {type === 'QRIS' ? (
                      <div className="flex items-center gap-3">
                        {isSafeBlobUrl(a.qrisImageUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.qrisImageUrl} alt={`QRIS ${a.provider}`} className="h-14 w-14 shrink-0 rounded-lg border bg-white object-contain" />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed bg-muted">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{a.provider}</p>
                          {!a.qrisImageUrl && (
                            <p className="flex items-center gap-1 text-[11px] text-amber-600">
                              <AlertTriangle className="h-3 w-3" /> Belum ada gambar — belum tampil di kasir & invoice
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {type === 'EWALLET' ? (
                          <span
                            className="inline-flex min-w-[44px] items-center justify-center rounded px-1.5 py-px text-[10px] font-bold tracking-wide text-white"
                            style={{ backgroundColor: ewalletColor(a.provider) }}
                          >
                            {a.provider}
                          </span>
                        ) : (
                          <p className="text-xs font-semibold text-muted-foreground">{a.provider}</p>
                        )}
                        <p className="mt-0.5 break-all text-sm font-semibold tabular-nums">{a.accountNumber}</p>
                        <p className="truncate text-[11px] text-muted-foreground">a.n. {a.accountName}</p>
                      </>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Switch
                      checked={a.isActive}
                      disabled={busyId === a.id}
                      onCheckedChange={(v) => toggleActive(a, v)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${a.provider}`}
                      onClick={() => setForm({ type, account: a })}
                    >
                      <Pencil className="h-4 w-4 text-gray-500" />
                    </Button>
                    <DeleteConfirmDialog
                      title={`Hapus ${PAYMENT_ACCOUNT_TYPE_LABEL[type]}?`}
                      description={`"${a.provider}" tidak akan tampil lagi di invoice dan dialog pembayaran. Tindakan ini tidak dapat dibatalkan.`}
                      onConfirm={async () => {
                        const res = await deletePaymentAccountAction(a.id);
                        if (res.success) await reload();
                        return res.success ? { success: true } : { success: false, error: res.error };
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {form && (
        <AccountFormDialog
          key={`${form.type}-${form.account?.id ?? 'new'}`}
          type={form.type}
          account={form.account}
          onClose={() => setForm(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}

// ─── Form tambah / edit ───────────────────────────────────────────────────────

function AccountFormDialog({
  type, account, onClose, onSaved,
}: {
  type: PaymentAccountType;
  account: PaymentAccountInfo | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEdit = !!account;
  const [provider, setProvider] = useState(account?.provider ?? '');
  const [number, setNumber]     = useState(account?.accountNumber ?? '');
  const [name, setName]         = useState(account?.accountName ?? '');
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    if (!QRIS_ALLOWED_MIME.includes(picked.type)) {
      toast({ title: 'Format tidak didukung', description: 'Gunakan JPG, PNG, atau WebP.', variant: 'destructive' });
      return;
    }
    if (picked.size > QRIS_MAX_SIZE_BYTES) {
      toast({ title: 'File terlalu besar', description: 'Ukuran gambar QRIS maksimal 2MB.', variant: 'destructive' });
      return;
    }
    setFile(picked);
  };

  const submit = async () => {
    const check = validatePaymentAccountInput({ type, provider, accountNumber: number, accountName: name });
    if (!check.ok) {
      toast({ title: 'Periksa isian', description: check.error, variant: 'destructive' });
      return;
    }
    if (type === 'QRIS' && !file && !account?.qrisImageUrl) {
      toast({ title: 'Gambar QRIS wajib diunggah', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let accountId = account?.id ?? '';

      if (account) {
        const res = await updatePaymentAccountAction(account.id, { provider, accountNumber: number, accountName: name });
        if (!res.success) { toast({ title: 'Gagal menyimpan', description: res.error, variant: 'destructive' }); return; }
      } else {
        const res = await createPaymentAccountAction({ type, provider, accountNumber: number, accountName: name });
        if (!res.success) { toast({ title: 'Gagal menyimpan', description: res.error, variant: 'destructive' }); return; }
        accountId = res.id;
      }

      if (type === 'QRIS' && file) {
        const fd = new FormData();
        fd.set('accountId', accountId);
        fd.set('file', file);
        try {
          const res    = await fetch('/api/store/payment-accounts/qris', { method: 'POST', body: fd });
          const result = await res.json();
          if (!res.ok || !result.success) {
            toast({
              title: 'Akun tersimpan, gambar gagal diunggah',
              description: `${result.error ?? 'Terjadi kesalahan.'} Buka Edit untuk mengunggah ulang.`,
              variant: 'destructive',
            });
            await onSaved();
            onClose();
            return;
          }
        } catch {
          toast({ title: 'Akun tersimpan, gambar gagal diunggah', description: 'Buka Edit untuk mengunggah ulang.', variant: 'destructive' });
          await onSaved();
          onClose();
          return;
        }
      }

      toast({ title: isEdit ? 'Perubahan disimpan' : `${PAYMENT_ACCOUNT_TYPE_LABEL[type]} ditambahkan` });
      await onSaved();
      onClose();
    } catch {
      toast({ title: 'Terjadi kesalahan', description: 'Coba lagi.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const suggestions = type === 'BANK' ? BANK_SUGGESTIONS : type === 'EWALLET' ? EWALLET_SUGGESTIONS : [];
  const currentImage = preview ?? (isSafeBlobUrl(account?.qrisImageUrl) ? account!.qrisImageUrl : null);

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="max-h-[90dvh] overflow-y-auto sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit' : 'Tambah'} {PAYMENT_ACCOUNT_TYPE_LABEL[type]}</DialogTitle>
          <DialogDescription className="text-xs">
            {type === 'QRIS'
              ? 'Unggah gambar QRIS toko (JPG, PNG, atau WebP, maks 2MB).'
              : 'Data ini akan tampil ke pelanggan di invoice dan di dialog pembayaran.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {type !== 'QRIS' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="pa-provider">{type === 'BANK' ? 'Nama Bank' : 'Nama E-Wallet'}</Label>
                <Input
                  id="pa-provider"
                  list="pa-provider-list"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder={type === 'BANK' ? 'mis. BRI' : 'mis. DANA'}
                  maxLength={40}
                  autoComplete="off"
                />
                <datalist id="pa-provider-list">
                  {suggestions.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pa-number">{type === 'BANK' ? 'No. Rekening' : 'Nomor E-Wallet'}</Label>
                <Input
                  id="pa-number"
                  inputMode="tel"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder={type === 'BANK' ? '1234 5678 9012' : '0812-3456-7890'}
                  maxLength={30}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pa-name">Atas Nama</Label>
                <Input
                  id="pa-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama pemilik rekening"
                  maxLength={60}
                  autoComplete="off"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="pa-label">Label (opsional)</Label>
                <Input
                  id="pa-label"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="mis. QRIS Toko Utama"
                  maxLength={40}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Gambar QRIS</Label>
                <input ref={fileRef} type="file" accept={QRIS_ALLOWED_MIME.join(',')} className="hidden" onChange={handleFile} />
                {currentImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentImage} alt="Pratinjau QRIS" className="mx-auto max-h-56 rounded-xl border bg-white object-contain p-2" />
                ) : (
                  <div className="flex h-32 items-center justify-center rounded-xl border border-dashed bg-muted/40 text-xs text-muted-foreground">
                    Belum ada gambar
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => fileRef.current?.click()} disabled={saving}>
                  <Upload className="mr-1.5 h-4 w-4" />
                  {currentImage ? 'Ganti gambar' : 'Pilih gambar'}
                </Button>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="bg-[#028697] text-white hover:bg-[#017585]">
            {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Menyimpan…</> : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
