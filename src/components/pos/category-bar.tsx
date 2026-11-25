'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface CategoryOption {
  name: string;
  icon: string | null;
}

interface CategoryBarProps {
  categories: CategoryOption[];
  /** Jumlah produk per nama kategori (tanpa memperhitungkan pencarian). */
  counts: Record<string, number>;
  /** Jumlah seluruh produk, untuk pil "Semua". */
  total: number;
  /** 'all' atau nama kategori. */
  active: string;
  onChange: (value: string) => void;
}

const ALL_KEY = '__all__';

const pillClass = (isActive: boolean) =>
  cn(
    'shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#028697]/40',
    isActive
      ? 'border-[#028697] bg-[#028697] text-white'
      : 'border-border bg-background text-muted-foreground hover:border-[#028697]/60'
  );

const countClass = (isActive: boolean) =>
  cn(
    'rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
    isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
  );

/**
 * Baris pil kategori POS.
 * - Roda mouse menggulir pil secara horizontal (hanya saat kursor di atas baris ini).
 * - Panah kiri/kanan (desktop) + efek pudar di tepi bila masih ada pil di luar layar.
 * - Pil aktif otomatis digulir ke area terlihat.
 * - Tombol "Semua kategori" (dropdown) muncul hanya bila pil melebihi lebar.
 */
export function CategoryBar({ categories, counts, total, active, onChange }: CategoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ canLeft: false, canRight: false, overflowing: false });

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = { canLeft: el.scrollLeft > 2, canRight: el.scrollLeft < max - 2, overflowing: max > 1 };
    setEdge((prev) =>
      prev.canLeft === next.canLeft && prev.canRight === next.canRight && prev.overflowing === next.overflowing
        ? prev
        : next
    );
  }, []);

  // Ukur ulang saat ukuran berubah atau daftar kategori berubah.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateEdges();
    el.addEventListener('scroll', updateEdges, { passive: true });
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      ro.disconnect();
    };
  }, [updateEdges, categories.length, counts]);

  // Roda mouse vertikal → gulir horizontal. Listener native karena harus non-passive.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return; // trackpad horizontal sudah native
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Pil aktif selalu terlihat penuh.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const key = active === 'all' ? ALL_KEY : active;
    const target = Array.from(el.querySelectorAll<HTMLElement>('[data-cat]')).find((b) => b.dataset.cat === key);
    if (!target) return;
    const pad = 44; // ruang untuk efek pudar/panah
    const left = target.offsetLeft;
    const right = left + target.offsetWidth;
    if (left < el.scrollLeft + pad) {
      el.scrollTo({ left: Math.max(0, left - pad), behavior: 'smooth' });
    } else if (right > el.scrollLeft + el.clientWidth - pad) {
      el.scrollTo({ left: right - el.clientWidth + pad, behavior: 'smooth' });
    }
  }, [active]);

  const scrollByPage = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <div
          ref={scrollRef}
          role="tablist"
          aria-label="Kategori produk"
          className="relative -my-1 flex gap-2 overflow-x-auto px-0.5 py-1 scrollbar-hide"
        >
          <button
            type="button"
            role="tab"
            aria-selected={active === 'all'}
            data-cat={ALL_KEY}
            onClick={() => onChange('all')}
            className={pillClass(active === 'all')}
          >
            <span>🛒 Semua</span>
            <span className={countClass(active === 'all')}>{total}</span>
          </button>
          {categories.map((cat) => {
            const isActive = active === cat.name;
            return (
              <button
                key={cat.name}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-cat={cat.name}
                onClick={() => onChange(cat.name)}
                className={pillClass(isActive)}
              >
                <span>{cat.icon ? `${cat.icon} ` : ''}{cat.name}</span>
                <span className={countClass(isActive)}>{counts[cat.name] ?? 0}</span>
              </button>
            );
          })}
        </div>

        {/* Efek pudar + panah (panah hanya di desktop; di layar sentuh cukup digeser) */}
        {edge.canLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-start bg-gradient-to-r from-background via-background/90 to-transparent">
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              aria-label="Geser kategori ke kiri"
              className="pointer-events-auto hidden h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground lg:flex"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}
        {edge.canRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-end bg-gradient-to-l from-background via-background/90 to-transparent">
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              aria-label="Geser kategori ke kanan"
              className="pointer-events-auto hidden h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground lg:flex"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {edge.overflowing && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Lihat semua kategori"
              title="Semua kategori"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-[#028697]/60 hover:text-[#028697] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#028697]/40"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
            <DropdownMenuItem onSelect={() => onChange('all')} className="cursor-pointer justify-between gap-3">
              <span className="truncate">🛒 Semua</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {total}
                {active === 'all' && <Check className="h-3.5 w-3.5 text-[#028697]" />}
              </span>
            </DropdownMenuItem>
            {categories.map((cat) => (
              <DropdownMenuItem
                key={cat.name}
                onSelect={() => onChange(cat.name)}
                className="cursor-pointer justify-between gap-3"
              >
                <span className="truncate">{cat.icon ? `${cat.icon} ` : ''}{cat.name}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {counts[cat.name] ?? 0}
                  {active === cat.name && <Check className="h-3.5 w-3.5 text-[#028697]" />}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
