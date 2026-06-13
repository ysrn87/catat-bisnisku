import { TabLayout } from '@/components/layouts/tab-layout';

export default async function ManagerSalesCustomersLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <TabLayout
      title="Penjualan & Pelanggan"
      description="Proses penjualan dan lihat data pelanggan"
      tabs={[
        { value: 'sales',     label: 'Penjualan', href: `/${slug}/manager/sales-customers/sales` },
        { value: 'customers', label: 'Customer',  href: `/${slug}/manager/sales-customers/customers` },
        { value: 'recap',     label: 'Rekap',     href: `/${slug}/manager/sales-customers/recap` },
      ]}
    >
      {children}
    </TabLayout>
  );
}
