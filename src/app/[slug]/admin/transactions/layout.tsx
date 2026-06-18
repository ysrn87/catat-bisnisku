import { TabLayout } from '@/components/layouts/tab-layout';

export default async function SalesCustomersLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <TabLayout
      title="Transaksi"
      description="Kelola transaksi penjualan dan data pelanggan"
      tabs={[
        { value: 'sales',     label: 'Penjualan', href: `/${slug}/admin/transactions/sales` },
        { value: 'customers', label: 'Customer',  href: `/${slug}/admin/transactions/customers` },
        { value: 'recap',     label: 'Rekap',     href: `/${slug}/admin/transactions/recap` },
      ]}
    >
      {children}
    </TabLayout>
  );
}
