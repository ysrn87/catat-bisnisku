'use client';

import Link from 'next/link';
import { Crown, Zap } from 'lucide-react';

interface PlanBadgeProps {
  plan: 'FREE' | 'PRO';
  storeSlug: string;
  compact?: boolean;
}

export function PlanBadge({ plan, storeSlug, compact = false }: PlanBadgeProps) {
  if (plan === 'PRO') {
    return (
      <span className={`inline-flex items-center gap-1 font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-300 ${compact ? 'text-[9px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'}`}>
        <Crown className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        PRO
      </span>
    );
  }

  return (
    <Link href={`/${storeSlug}/upgrade`}>
      <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-gray-100 text-gray-500 border border-gray-200 hover:bg-[#00a090]/10 hover:text-[#00a090] hover:border-[#00a090]/30 transition-colors cursor-pointer ${compact ? 'text-[9px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'}`}>
        <Zap className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        FREE
      </span>
    </Link>
  );
}
