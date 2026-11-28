import Link from 'next/link';
import { cn } from '@/lib/utils';
import { RANGE_OPTIONS, queryForRange, queryToSearch, type RangeWindow } from '@/lib/dashboard-range';

/** Pilihan mode periode. Berpindah mode mempertahankan konteks tanggal (lihat queryForRange). */
export function RangeFilter({ basePath, win }: { basePath: string; win: RangeWindow }) {
  return (
    <div
      role="tablist"
      aria-label="Filter periode"
      className="inline-flex w-full gap-1 rounded-xl bg-muted p-1 sm:w-auto"
    >
      {RANGE_OPTIONS.map((opt) => {
        const isActive = opt.value === win.range;
        return (
          <Link
            key={opt.value}
            role="tab"
            aria-selected={isActive}
            href={`${basePath}${queryToSearch(queryForRange(win, opt.value))}`}
            scroll={false}
            prefetch
            className={cn(
              'flex-1 rounded-lg px-3.5 py-1.5 text-center text-sm font-medium transition-all sm:flex-none sm:px-4',
              isActive
                ? 'bg-background text-[#028697] shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
