'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { CalendarDays, X } from 'lucide-react';

interface DateRangeFilterProps {
  defaultFrom?: string;
  defaultTo?:   string;
}

// Preset periode
const PRESETS = [
  { label: 'Bulan Ini',    getValue: () => getMonthRange(0) },
  { label: 'Bulan Lalu',   getValue: () => getMonthRange(-1) },
  { label: 'Tahun Ini',    getValue: () => getYearRange() },
];

function getMonthRange(offset: number) {
  const now   = new Date();
  const year  = now.getMonth() + offset < 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = ((now.getMonth() + offset) % 12 + 12) % 12;
  const from  = new Date(year, month, 1);
  const to    = new Date(year, month + 1, 0);
  return { from: fmt(from), to: fmt(to) };
}

function getYearRange() {
  const year = new Date().getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function fmt(d: Date) {
  return d.toISOString().split('T')[0];
}

export function DateRangeFilter({ defaultFrom, defaultTo }: DateRangeFilterProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [from, setFrom] = useState(defaultFrom || '');
  const [to,   setTo]   = useState(defaultTo   || '');

  const apply = (f: string, t: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (f) params.set('dateFrom', f); else params.delete('dateFrom');
    if (t) params.set('dateTo',   t); else params.delete('dateTo');
    router.push(`${pathname}?${params.toString()}`);
  };

  const reset = () => {
    setFrom('');
    setTo('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('dateFrom');
    params.delete('dateTo');
    router.push(`${pathname}?${params.toString()}`);
  };

  const isFiltered = !!(defaultFrom || defaultTo);

  return (
    <div className="flex flex-col gap-3">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => {
              const { from: f, to: t } = p.getValue();
              setFrom(f);
              setTo(t);
              apply(f, t);
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Manual input */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-end">
          <div className="space-y-1 min-w-0">
            <Label className="text-xs text-muted-foreground">Dari</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 text-xs w-full sm:w-36"
            />
          </div>
          <div className="space-y-1 min-w-0">
            <Label className="text-xs text-muted-foreground">Sampai</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 text-xs w-full sm:w-36"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => apply(from, to)}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Terapkan
          </Button>
          {isFiltered && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1 text-muted-foreground"
              onClick={reset}
            >
              <X className="w-3.5 h-3.5" />
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
