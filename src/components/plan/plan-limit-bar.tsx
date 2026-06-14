'use client';

import Link from 'next/link';
import { AlertTriangle, Zap } from 'lucide-react';

interface PlanLimitBarProps {
  label: string;
  current: number;
  limit: number;
  plan: 'FREE' | 'PRO';
  storeSlug: string;
  upgradeText?: string;
}

export function PlanLimitBar({
  label,
  current,
  limit,
  plan,
  storeSlug,
  upgradeText = 'Upgrade ke PRO untuk unlimited',
}: PlanLimitBarProps) {
  if (plan === 'PRO') return null;

  const pct     = Math.min((current / limit) * 100, 100);
  const isNear  = pct >= 80;
  const isFull  = pct >= 100;

  const barColor = isFull
    ? 'bg-red-500'
    : isNear
    ? 'bg-amber-400'
    : 'bg-[#00a090]';

  const textColor = isFull
    ? 'text-red-600'
    : isNear
    ? 'text-amber-600'
    : 'text-gray-500';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={`font-semibold ${textColor}`}>
          {current} / {limit}
          {isFull && <AlertTriangle className="inline w-3 h-3 ml-1 mb-0.5" />}
        </span>
      </div>

      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {isNear && (
        <Link
          href={`/${storeSlug}/upgrade`}
          className={`flex items-center gap-1 text-[10px] font-medium mt-0.5 hover:underline ${
            isFull ? 'text-red-600' : 'text-amber-600'
          }`}
        >
          <Zap className="w-2.5 h-2.5" />
          {upgradeText}
        </Link>
      )}
    </div>
  );
}
