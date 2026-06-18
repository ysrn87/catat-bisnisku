'use client';

import { useState } from 'react';
import { Home, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardTabsProps {
  berandaContent: React.ReactNode;
  posContent: React.ReactNode;
}

export function DashboardTabs({ berandaContent, posContent }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<'beranda' | 'pos'>('beranda');

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('beranda')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'beranda'
              ? 'border-[#00a090] text-[#00a090]'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          )}
        >
          <Home className="w-4 h-4" />
          Beranda
        </button>
        <button
          onClick={() => setActiveTab('pos')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'pos'
              ? 'border-[#00a090] text-[#00a090]'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          )}
        >
          <ShoppingCart className="w-4 h-4" />
          POS Kasir
        </button>
      </div>

      {/* Tab content */}
      <div>
        <div className={activeTab === 'beranda' ? 'block' : 'hidden'}>
          {berandaContent}
        </div>
        <div className={activeTab === 'pos' ? 'block' : 'hidden'}>
          {posContent}
        </div>
      </div>
    </div>
  );
}
