'use client';

import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface SalesTrendPoint {
  label: string;
  total: number;
}

interface SalesTrendChartProps {
  data: SalesTrendPoint[];
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as SalesTrendPoint;
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm">
      <p className="text-xs text-gray-400">{point.label}</p>
      <p className="text-sm font-medium text-gray-900">{formatCurrency(point.total)}</p>
    </div>
  );
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  const hasData = data.some((d) => d.total > 0);

  if (!hasData) {
    return (
      <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">
        Belum ada data penjualan untuk ditampilkan
      </div>
    );
  }

  return (
    <div className="h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#028697" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#028697" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            interval="preserveStartEnd"
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#028697"
            strokeWidth={2.5}
            fill="url(#salesTrendFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
