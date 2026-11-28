import { TabLayout } from '@/components/layouts/tab-layout';

export default async function ManagerDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <TabLayout
      title="Dashboard"
      description="Kelola transaksi kasir dan pantau ringkasan toko kamu"
      tabs={[
        { value: 'pos',       label: 'POS Kasir', href: `/${slug}/manager` },
        { value: 'ringkasan', label: 'Ringkasan', href: `/${slug}/manager/summary` },
      ]}
    >
      {children}
    </TabLayout>
  );
}
