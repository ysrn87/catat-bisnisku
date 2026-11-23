'use client';

import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/utils';

export interface SalesTrendPoint {
  label: string;     // label sumbu X
  tooltip: string;   // label lengkap di tooltip
  paid: number;      // omzet lunas
  pending: number;   // nominal pending
}

interface SalesTrendChartProps {
  data: SalesTrendPoint[];
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as SalesTrendPoint;
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm">
      <p className="text-xs text-gray-400">{point.tooltip}</p>
      <p className="text-sm font-medium text-gray-900">{formatCurrency(point.paid)}</p>
      {point.pending > 0 && (
        <p className="text-xs font-medium text-amber-600">Pending {formatCurrency(point.pending)}</p>
      )}
    </div>
  );
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  const hasData = data.some((d) => d.paid > 0 || d.pending > 0);
  const hasPending = data.some((d) => d.pending > 0);

  if (!hasData) {
    return (
      <div className="flex h-[170px] items-center justify-center text-sm text-gray-400 md:h-[220px]">
        Belum ada data penjualan pada periode ini
      </div>
    );
  }

  return (
    <div>
      <div className="h-[170px] md:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#028697" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#028697" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              interval="preserveStartEnd"
              minTickGap={14}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="paid"
              stroke="#028697"
              strokeWidth={2.5}
              fill="url(#salesTrendFill)"
            />
            {hasPending && (
              <Area
                type="monotone"
                dataKey="pending"
                stroke="#d97706"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="none"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#028697]" /> Lunas
        </span>
        {hasPending && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-600" /> Pending
          </span>
        )}
      </div>
    </div>
  );
}
