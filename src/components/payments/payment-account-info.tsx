'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActivePaymentAccounts } from '@/actions/payment-accounts';
import {
  accountTypeForMethod,
  displayableAccounts,
  ewalletColor,
  isSafeBlobUrl,
  type PaymentAccountInfo,
} from '@/lib/payment-accounts';

// ─── Hook: ambil akun aktif toko (segar setiap dialog dibuka) ─────────────────

export function useActivePaymentAccounts(enabled: boolean) {
  const [accounts, setAccounts] = useState<PaymentAccountInfo[]>([]);
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getActivePaymentAccounts()
      .then((rows) => { if (!cancelled) { setAccounts(rows); setLoaded(true); } })
      // Gagal (mis. offline): pakai data terakhir yang berhasil dimuat, jangan blokir kasir.
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [enabled]);

  return { accounts, loaded };
}

// ─── Tombol salin ─────────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard bisa ditolak (mis. HTTP / izin) — nomor tetap terlihat untuk disalin manual.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Salin ${label}`}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors',
        copied
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-border bg-background text-muted-foreground hover:border-[#028697]/60 hover:text-[#028697]'
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Tersalin' : 'Salin'}
    </button>
  );
}

// ─── Panel info pembayaran sesuai metode yang dipilih ─────────────────────────

const EMPTY_HINT = {
  BANK:    'Belum ada rekening bank. Admin dapat menambahkannya di Pengaturan › Pembayaran.',
  EWALLET: 'Belum ada e-wallet. Admin dapat menambahkannya di Pengaturan › Pembayaran.',
  QRIS:    'Belum ada gambar QRIS. Admin dapat mengunggahnya di Pengaturan › Pembayaran.',
} as const;

export function PaymentAccountPanel({
  method, accounts, loaded, className,
}: {
  method: string;
  accounts: PaymentAccountInfo[];
  loaded: boolean;
  className?: string;
}) {
  const type = accountTypeForMethod(method);
  if (!type) return null; // Tunai / Kartu: tidak ada info tujuan pembayaran

  if (!loaded) {
    return <div className={cn('h-14 animate-pulse rounded-xl bg-muted/60', className)} aria-hidden />;
  }

  const list = displayableAccounts(accounts, type);

  if (list.length === 0) {
    return (
      <p className={cn('rounded-lg bg-muted px-3 py-2 text-[11px] leading-snug text-muted-foreground', className)}>
        {EMPTY_HINT[type]}
      </p>
    );
  }

  if (type === 'QRIS') {
    return (
      <div className={cn('grid gap-3', list.length > 1 && 'sm:grid-cols-2', className)}>
        {list.map((a) =>
          isSafeBlobUrl(a.qrisImageUrl) ? (
            <a
              key={a.id}
              href={a.qrisImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-white p-3"
              aria-label={`Buka gambar ${a.provider} ukuran penuh`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.qrisImageUrl}
                alt={`QRIS ${a.provider}`}
                loading="lazy"
                className="max-h-64 w-full max-w-[240px] object-contain"
              />
              <span className="text-[11px] font-medium text-gray-600">{a.provider}</span>
              <span className="text-[10px] text-muted-foreground">Ketuk untuk memperbesar</span>
            </a>
          ) : null
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {list.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3">
          <div className="min-w-0">
            {type === 'EWALLET' ? (
              <span
                className="inline-flex min-w-[44px] items-center justify-center rounded px-1.5 py-px text-[10px] font-bold tracking-wide text-white"
                style={{ backgroundColor: ewalletColor(a.provider) }}
              >
                {a.provider}
              </span>
            ) : (
              <p className="text-[11px] font-semibold text-muted-foreground">{a.provider}</p>
            )}
            <p className="mt-0.5 break-all text-sm font-semibold tabular-nums tracking-wide">{a.accountNumber}</p>
            {a.accountName && (
              <p className="truncate text-[11px] text-muted-foreground">a.n. {a.accountName}</p>
            )}
          </div>
          {a.accountNumber && <CopyButton value={a.accountNumber.replace(/[\s-]/g, '')} label={`nomor ${a.provider}`} />}
        </div>
      ))}
    </div>
  );
}
