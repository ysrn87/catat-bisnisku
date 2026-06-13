import { TabLayout } from '@/components/layouts/tab-layout';

export default async function FinanceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <TabLayout
      title="Keuangan"
      description="Kelola cashflow dan laporan keuangan"
      tabs={[
        { value: 'cashflow', label: 'Cashflow',         href: `/${slug}/admin/finance/cashflow` },
        { value: 'reports',  label: 'Laporan Keuangan', href: `/${slug}/admin/finance/reports` },
      ]}
    >
      {children}
    </TabLayout>
  );
}
