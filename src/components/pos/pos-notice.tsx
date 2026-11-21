'use client';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PosNoticeData {
  id: number;
  tone: 'info' | 'error' | 'success';
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

const TONES = {
  info:    { icon: Info,          bar: 'bg-[#028697]',  iconCls: 'text-[#028697]' },
  success: { icon: CheckCircle2,  bar: 'bg-emerald-500', iconCls: 'text-emerald-600' },
  error:   { icon: AlertCircle,   bar: 'bg-red-500',    iconCls: 'text-red-600' },
} as const;

/**
 * Notifikasi khusus POS. Sengaja BUKAN toast global: toast global muncul di kanan-bawah layar desktop
 * dan menutupi tombol "Proses Transaksi". Posisi di sini mengikuti tata letak POS:
 *  - HP/tablet: di bawah header, di atas bottom sheet keranjang (tidak menimpa bar bawah)
 *  - Desktop  : kiri-bawah area produk (tidak menimpa kolom keranjang)
 */
export function PosNotice({ notice, onDismiss }: { notice: PosNoticeData | null; onDismiss: () => void }) {
  if (!notice) return null;
  const { icon: Icon, bar, iconCls } = TONES[notice.tone];

  return (
    <div
      className="pointer-events-none fixed inset-x-3 top-[4.25rem] z-[70] flex justify-center lg:absolute lg:inset-x-auto lg:bottom-3 lg:left-3 lg:top-auto lg:z-30 lg:justify-start"
      role="status"
      aria-live="polite"
    >
      <div
        key={notice.id}
        className="pointer-events-auto relative flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-xl border border-border bg-card py-2.5 pl-4 pr-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 lg:slide-in-from-bottom-2"
      >
        <span className={cn('absolute inset-y-0 left-0 w-1', bar)} aria-hidden />
        <Icon className={cn('h-4 w-4 shrink-0', iconCls)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{notice.title}</p>
          {notice.description && <p className="text-xs leading-snug text-muted-foreground">{notice.description}</p>}
        </div>
        {notice.action && (
          <button
            type="button"
            onClick={() => { notice.action!.onClick(); onDismiss(); }}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-[#028697] transition-colors hover:bg-[#028697]/10"
          >
            {notice.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:text-foreground"
          aria-label="Tutup notifikasi"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
