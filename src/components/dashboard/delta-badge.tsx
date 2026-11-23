import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Badge perubahan vs periode pembanding. `invert` = naik berarti buruk (mis. pending). */
export function DeltaBadge({
  value,
  label,
  invert = false,
  onDark = false,
}: {
  value: number | null;
  label: string;
  invert?: boolean;
  onDark?: boolean;
}) {
  if (value === null) {
    return (
      <p className={cn('mt-1 text-[10px] md:text-xs', onDark ? 'text-white/70' : 'text-muted-foreground')}>
        Belum ada data {label}
      </p>
    );
  }
  const rounded = Math.round(value);
  const flat = rounded === 0;
  const good = invert ? value < 0 : value > 0;
  const Icon = flat ? Minus : value > 0 ? TrendingUp : TrendingDown;

  return (
    <p className="mt-1 flex flex-wrap items-center gap-1 text-[10px] md:text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold',
          onDark
            ? 'bg-white/15 text-white'
            : flat
              ? 'bg-gray-100 text-gray-600'
              : good
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-600'
        )}
      >
        <Icon className="h-3 w-3" />
        {flat ? '0%' : `${value > 0 ? '+' : ''}${rounded}%`}
      </span>
      <span className={onDark ? 'text-white/70' : 'text-muted-foreground'}>vs {label}</span>
    </p>
  );
}
