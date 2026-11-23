import Link from 'next/link';
import { cn } from '@/lib/utils';
import { RANGE_OPTIONS, type DashboardRange } from '@/lib/dashboard-range';

export function RangeFilter({ slug, active }: { slug: string; active: DashboardRange }) {
  return (
    <div
      role="tablist"
      aria-label="Filter periode"
      className="inline-flex w-full gap-1 rounded-xl bg-muted p-1 sm:w-auto"
    >
      {RANGE_OPTIONS.map((opt) => {
        const isActive = opt.value === active;
        return (
          <Link
            key={opt.value}
            role="tab"
            aria-selected={isActive}
            href={`/${slug}/admin/summary?range=${opt.value}`}
            scroll={false}
            prefetch
            className={cn(
              'flex-1 rounded-lg px-4 py-1.5 text-center text-sm font-medium transition-all sm:flex-none',
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
