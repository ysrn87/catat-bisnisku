'use client';

import { NewSaleDialog } from '@/components/sales/new-sale-dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface SalesActionsProps {
  variants: any[];
  customers: any[];
  nonMemberCustomers: any[];
  conversionRate: number;
}

const FAB_CLASS = [
  'sm:hidden fixed bottom-24 right-6 z-50',
  'w-12 h-12 rounded-full bg-[#028697] text-white shadow-lg',
  'flex items-center justify-center',
  'hover:bg-[#017585] active:scale-95 transition-all',
].join(' ');

export function SalesActions({
  variants, customers, nonMemberCustomers, conversionRate,
}: SalesActionsProps) {
  return (
    <NewSaleDialog
      variants={variants}
      customers={customers}
      nonMemberCustomers={nonMemberCustomers}
      conversionRate={conversionRate}
      trigger={
        <div>
          <Button className="hidden sm:inline-flex bg-[#028697] hover:bg-[#017585] text-white shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Penjualan Baru
          </Button>

          <button type="button" aria-label="Penjualan Baru" className={FAB_CLASS}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      }
    />
  );
}
