'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { triggerLoader } from '@/components/layouts/navigation-loader';
import { cn } from '@/lib/utils';

export interface PaletteEntry {
  href: string;
  label: string;
  /** Nama menu induk, mis. "Inventori" untuk submenu "Produk". */
  section?: string;
  icon?: ReactNode;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: PaletteEntry[];
  currentPath: string;
}

export function CommandPalette({ open, onOpenChange, entries, currentPath }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Setiap kali dibuka, mulai dari kondisi bersih.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return entries;

    return entries
      .map((entry) => {
        const label = entry.label.toLowerCase();
        const haystack = `${label} ${(entry.section ?? '').toLowerCase()}`;
        if (!tokens.every((t) => haystack.includes(t))) return null;
        // Kecocokan di awal nama halaman diutamakan.
        const score = label.startsWith(tokens[0]) ? 0 : label.includes(tokens[0]) ? 1 : 2;
        return { entry, score };
      })
      .filter((r): r is { entry: PaletteEntry; score: number } => r !== null)
      .sort((a, b) => a.score - b.score)
      .map((r) => r.entry);
  }, [entries, query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (entry: PaletteEntry | undefined) => {
    if (!entry) return;
    onOpenChange(false);
    if (entry.href !== currentPath) {
      triggerLoader();
      router.push(entry.href);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length) setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length) setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[16%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogTitle className="sr-only">Cari halaman</DialogTitle>
        <DialogDescription className="sr-only">
          Ketik nama halaman, gunakan panah untuk memilih, lalu tekan Enter untuk membukanya.
        </DialogDescription>

        <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3 pr-12">
          <Search className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Cari halaman… (mis. produk, kas, pelanggan)"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-palette-list"
            aria-activedescendant={results.length ? `cmd-palette-opt-${active}` : undefined}
            className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">Tidak ada halaman yang cocok</p>
        ) : (
          <ul
            ref={listRef}
            id="cmd-palette-list"
            role="listbox"
            className="max-h-[320px] overflow-y-auto p-1.5"
          >
            {results.map((entry, i) => {
              const isActive = i === active;
              return (
                <li
                  key={entry.href}
                  id={`cmd-palette-opt-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={isActive}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(entry)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                    isActive ? 'bg-[#028697]/10 text-gray-900' : 'text-gray-600'
                  )}
                >
                  {entry.icon && (
                    <span className={cn('flex-shrink-0', isActive ? 'text-[#028697]' : 'text-gray-400')}>
                      {entry.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {entry.section && <span className="text-gray-400">{entry.section} / </span>}
                    <span className="font-medium">{entry.label}</span>
                  </span>
                  {entry.href === currentPath ? (
                    <span className="flex-shrink-0 text-[11px] text-gray-400">Sedang dibuka</span>
                  ) : (
                    isActive && <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-[#028697]" aria-hidden />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center gap-4 border-t border-gray-100 bg-gray-50/60 px-4 py-2 text-[11px] text-gray-400">
          <span>↑↓ pilih</span>
          <span>Enter buka</span>
          <span>Esc tutup</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
