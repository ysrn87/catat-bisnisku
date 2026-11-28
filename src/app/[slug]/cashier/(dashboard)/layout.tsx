import { TabLayout } from '@/components/layouts/tab-layout';

export default async function CashierDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <TabLayout
      title="Dashboard Kasir"
      description="Catat penjualan dan pantau ringkasan penjualan kamu"
      tabs={[
        { value: 'pos',       label: 'POS Kasir',     href: `/${slug}/cashier` },
        { value: 'ringkasan', label: 'Ringkasan Saya', href: `/${slug}/cashier/summary` },
      ]}
    >
      {children}
    </TabLayout>
  );
}
