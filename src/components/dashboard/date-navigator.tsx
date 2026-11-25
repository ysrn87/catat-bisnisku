'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_CUSTOM_DAYS, queryToSearch, type DashboardRange } from '@/lib/dashboard-range';

interface DateNavigatorProps {
  slug: string;
  range: DashboardRange;
  /** Tanggal acuan (day/week/month). */
  anchorYmd: string;
  /** Awal & akhir periode (dipakai untuk mode kustom). */
  fromYmd: string;
  toYmd: string;
  todayYmd: string;
  prevHref: string | null;
  nextHref: string | null;
  todayHref: string | null;
}

const inputClass =
  'h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#028697]/40 disabled:opacity-50';

const arrowClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors';

/**
 * Pemilih tanggal untuk Ringkasan:
 *  - Harian/Mingguan/Bulanan: satu tanggal acuan + panah periode sebelumnya/berikutnya + "Hari ini".
 *  - Kustom: rentang Dari–Sampai dengan tombol Terapkan.
 * Semua perubahan ditulis ke URL, jadi halaman tetap dirender di server.
 */
export function DateNavigator({
  slug, range, anchorYmd, fromYmd, toYmd, todayYmd, prevHref, nextHref, todayHref,
}: DateNavigatorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const base = `/${slug}/admin/summary`;

  const [from, setFrom] = useState(fromYmd);
  const [to, setTo] = useState(toYmd);
  useEffect(() => {
    setFrom(fromYmd);
    setTo(toYmd);
  }, [fromYmd, toYmd]);

  const go = (search: string) => startTransition(() => router.push(`${base}${search}`));

  const dateHint =
    range === 'week' ? 'Tanggal akhir dari 7 hari' : range === 'month' ? 'Bulan dari tanggal ini' : 'Tanggal';

  return (
    <div className={cn('flex flex-wrap items-center gap-2 transition-opacity', isPending && 'opacity-70')}>
      {prevHref ? (
        <Link href={prevHref} scroll={false} aria-label="Periode sebelumnya" className={cn(arrowClass, 'hover:border-[#028697]/60 hover:text-[#028697]')}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span aria-hidden className={cn(arrowClass, 'opacity-40')}><ChevronLeft className="h-4 w-4" /></span>
      )}

      {range === 'custom' ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Dari</span>
            <input
              type="date"
              value={from}
              max={todayYmd}
              onChange={(e) => setFrom(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Sampai</span>
            <input
              type="date"
              value={to}
              max={todayYmd}
              onChange={(e) => setTo(e.target.value)}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            disabled={!from || !to || isPending}
            onClick={() => go(queryToSearch({ range: 'custom', from, to }))}
            className="h-9 rounded-lg bg-[#028697] px-4 text-sm font-medium text-white transition-colors hover:bg-[#027080] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#028697]/40 disabled:opacity-50"
          >
            Terapkan
          </button>
        </div>
      ) : (
        <label className="flex items-center gap-2">
          <span className="sr-only">{dateHint}</span>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={anchorYmd}
              max={todayYmd}
              title={dateHint}
              onChange={(e) => {
                if (e.target.value) go(queryToSearch({ range, date: e.target.value }));
              }}
              className={cn(inputClass, 'pl-8')}
            />
          </div>
        </label>
      )}

      {nextHref ? (
        <Link href={nextHref} scroll={false} aria-label="Periode berikutnya" className={cn(arrowClass, 'hover:border-[#028697]/60 hover:text-[#028697]')}>
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span aria-hidden className={cn(arrowClass, 'opacity-40')}><ChevronRight className="h-4 w-4" /></span>
      )}

      {todayHref && (
        <Link
          href={todayHref}
          scroll={false}
          className="h-9 inline-flex items-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-[#028697]/60 hover:text-[#028697]"
        >
          {range === 'custom' ? 'Sampai hari ini' : 'Hari ini'}
        </Link>
      )}

      {isPending && <Loader2 className="h-4 w-4 animate-spin text-[#028697]" aria-label="Memuat" />}
      {range === 'custom' && (
        <span className="basis-full text-[11px] text-muted-foreground">Maksimal {MAX_CUSTOM_DAYS} hari per rentang.</span>
      )}
    </div>
  );
}
