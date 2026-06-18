'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
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
  /** Gunakan router.push saat tab tidak pakai href (e.g. sales-customers) */
  useRouterPush?: boolean;
}

export function TabLayout({ title, description, tabs, children, useRouterPush = false }: TabLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const currentTab = tabs.find((t) =>
    t.href ? pathname.includes(t.href) : pathname.endsWith(t.value)
  )?.value ?? tabs[0].value;

  return (
    <div className="-mt-7 md:-mt-0">
      <div className="hidden md:block mb-6">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-gray-600">{description}</p>
      </div>

      <Tabs
        value={currentTab}
        onValueChange={useRouterPush ? (v) => router.push(`${pathname.split('/').slice(0, -1).join('/')}/${v}`) : undefined}
      >
        {/* Tab navigasi sub-halaman — hanya untuk mobile/tablet.
            Di desktop (lg+), navigasi yang sama sudah tersedia di sidebar. */}
        <div className="lg:hidden sticky top-16 z-30 bg-gray-50 -mx-4 px-4 md:-mx-6 md:px-6 py-3 border-b border-gray-200 shadow-sm">
          <TabsList className={`grid w-full max-w-${tabs.length === 2 ? 'md' : 'lg'} grid-cols-${tabs.length}`}>
            {tabs.map((tab) =>
              tab.href ? (
                <TabsTrigger key={tab.value} value={tab.value} asChild>
                  <Link href={tab.href}>{tab.label}</Link>
                </TabsTrigger>
              ) : (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              )
            )}
          </TabsList>
        </div>

        <div className="pt-6 lg:pt-0">{children}</div>
      </Tabs>
    </div>
  );
}
