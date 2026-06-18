'use client';

import Link from 'next/link';
import { Crown } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PlanGateProps {
  plan: 'FREE' | 'PRO';
  storeSlug: string;
  feature: string;
  description?: string;
  children: React.ReactNode;
  /** Mode tampilan overlay. Default: 'icon' — tampilkan crown kecil di sudut tombol. */
  mode?: 'icon' | 'overlay';
}

/**
 * Membungkus fitur PRO-only.
 *
 * Mode 'icon' (default): Menampilkan icon Crown kecil di sudut kanan atas
 *   children. Cocok untuk tombol / elemen kecil yang tidak boleh overlap.
 *
 * Mode 'overlay': Menampilkan overlay blur dengan tombol upgrade di tengah.
 *   Cocok untuk card / section besar.
 */
export function PlanGate({
  plan,
  storeSlug,
  feature,
  description,
  children,
  mode = 'icon',
}: PlanGateProps) {
  // PRO → render children langsung tanpa perubahan apapun
  if (plan === 'PRO') return <>{children}</>;

  // FREE + mode icon → wrap dengan tooltip crown kecil
  if (mode === 'icon') {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={`/${storeSlug}/upgrade`} className="relative inline-flex">
              {/* Children di-render normal tapi tidak bisa diklik (pointer-events-none) */}
              <span className="pointer-events-none select-none opacity-60">
                {children}
              </span>
              {/* Crown kecil di sudut kanan atas */}
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center shadow-sm ring-2 ring-white">
                <Crown className="w-2.5 h-2.5 text-white" />
              </span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px] text-center">
            <p className="font-semibold text-xs">{feature} — Fitur PRO</p>
            {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
            <p className="text-xs text-amber-500 mt-1 font-medium">Klik untuk upgrade →</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // FREE + mode overlay → overlay besar (untuk card / section)
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[2px] opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px] border border-amber-200">
        <div className="text-center space-y-2 px-4">
          <div className="mx-auto w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center">
            <Crown className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-sm font-semibold text-gray-800">{feature}</p>
          {description && (
            <p className="text-xs text-gray-500 max-w-[180px]">{description}</p>
          )}
          <Link href={`/${storeSlug}/upgrade`}>
            <button className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors">
              <Crown className="w-3 h-3" /> Upgrade ke PRO
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
