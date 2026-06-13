import { TabLayout } from '@/components/layouts/tab-layout';

export default function SalesCustomersLayout({ children }: { children: React.ReactNode }) {
  return (
    <TabLayout
      title="Penjualan & Pelanggan"
      description="Kelola transaksi penjualan dan data pelanggan"
      tabs={[
        { value: 'sales',     label: 'Penjualan' },
        { value: 'customers', label: 'Customer' },
        { value: 'recap',     label: 'Rekap' },
      ]}
      useRouterPush
    >
      {children}
    </TabLayout>
  );
}
