import { TabLayout } from '@/components/layouts/tab-layout';

export default function ManagerSalesCustomersLayout({ children }: { children: React.ReactNode }) {
  return (
    <TabLayout
      title="Penjualan & Pelanggan"
      description="Proses penjualan dan lihat data pelanggan"
      tabs={[
        { value: 'sales',     label: 'Penjualan', href: '/manager/sales-customers/sales' },
        { value: 'customers', label: 'Customer',  href: '/manager/sales-customers/customers' },
        { value: 'recap',     label: 'Rekap',     href: '/manager/sales-customers/recap' },
      ]}
    >
      {children}
    </TabLayout>
  );
}
