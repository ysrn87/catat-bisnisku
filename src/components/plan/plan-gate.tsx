'use client';

import Link from 'next/link';
import { Crown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlanGateProps {
  plan: 'FREE' | 'PRO';
  storeSlug: string;
  feature: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Membungkus fitur PRO-only.
 * Kalau plan FREE → tampilkan overlay upgrade, children tetap di-render tapi blur.
 * Kalau plan PRO → render children langsung.
 *
 * Contoh:
 *   <PlanGate plan={storePlan} storeSlug={slug} feature="Export Laporan">
 *     <ExportButton />
 *   </PlanGate>
 */
export function PlanGate({ plan, storeSlug, feature, description, children }: PlanGateProps) {
  if (plan === 'PRO') return <>{children}</>;

  return (
    <div className="relative">
      {/* Children di-render tapi blur dan tidak bisa diklik */}
      <div className="pointer-events-none select-none blur-[2px] opacity-50">
        {children}
      </div>

      {/* Overlay upgrade */}
      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-[1px] border border-amber-200">
        <div className="text-center space-y-2 px-4">
          <div className="mx-auto w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center">
            <Lock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-sm font-semibold text-gray-800">{feature}</p>
          {description && (
            <p className="text-xs text-gray-500 max-w-[180px]">{description}</p>
          )}
          <Link href={`/${storeSlug}/upgrade`}>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 mt-1">
              <Crown className="w-3.5 h-3.5" />
              Upgrade ke PRO
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
