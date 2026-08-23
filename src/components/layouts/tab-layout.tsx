'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { triggerLoader } from '@/components/layouts/navigation-loader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface TabItem {
  value: string;
  label: string;
  href?: string;
}

interface TabLayoutProps {
  title: string;
  description: string;
  tabs: TabItem[];
  children: React.ReactNode;
  /** Gunakan router.push saat tab tidak pakai href (e.g. transactions) */
  useRouterPush?: boolean;
}

export function TabLayout({ title, description, tabs, children, useRouterPush = false }: TabLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const currentTab = [...tabs]
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))
    .find((t) =>
      t.href ? pathname === t.href || pathname.startsWith(t.href + '/') : pathname.endsWith(t.value)
    )?.value ?? tabs[0].value;

  const handleTabClick = (href: string) => {
    triggerLoader();
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <div className="-mt-7 md:-mt-0">
      <div className="hidden md:block mb-6">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-gray-600">{description}</p>
      </div>

      <Tabs
        value={currentTab}
        onValueChange={useRouterPush ? (v) => startTransition(() => router.push(`${pathname.split('/').slice(0, -1).join('/')}/${v}`)) : undefined}
      >
        {/* Tab navigasi sub-halaman — hanya untuk mobile/tablet.
            Di desktop (lg+), navigasi yang sama sudah tersedia di sidebar. */}
        <div className="lg:hidden sticky top-16 z-30 bg-gray-50 -mx-4 px-4 md:-mx-6 md:px-6 py-3 border-b border-gray-200 shadow-sm">
          <TabsList
            className="grid w-full"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map((tab) =>
              tab.href ? (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  onClick={() => handleTabClick(tab.href!)}
                  className="flex items-center gap-1.5"
                >
                  {isPending && currentTab !== tab.value && (
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  )}
                  {tab.label}
                </TabsTrigger>
              ) : (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-1.5"
                >
                  {tab.label}
                </TabsTrigger>
              )
            )}
          </TabsList>
        </div>

        <div className={`pt-6 lg:pt-0 transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          {children}
        </div>
      </Tabs>
    </div>
  );
}
