'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ReportTabsProps {
  activeTab: string;
  children: React.ReactNode;
}

/**
 * Client wrapper around Radix Tabs so the active tab persists via the
 * `?tab=` URL param (survives page refresh) without leaking event handler
 * functions into a Server Component prop tree.
 */
export function ReportTabs({ activeTab, children }: ReportTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
      <TabsList className="grid w-full max-w-sm grid-cols-3">
        <TabsTrigger value="financial">Keuangan</TabsTrigger>
        <TabsTrigger value="sales">Penjualan</TabsTrigger>
        <TabsTrigger value="inventory">Inventori</TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  );
}
