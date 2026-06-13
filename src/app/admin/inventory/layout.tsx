import { TabLayout } from '@/components/layouts/tab-layout';

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <TabLayout
      title="Manajemen Inventori"
      description="Kelola produk, stok, dan laporan inventori"
      tabs={[
        { value: 'products', label: 'Produk',  href: '/admin/inventory/products' },
        { value: 'stock',    label: 'Stok',    href: '/admin/inventory/stock' },
        { value: 'reports',  label: 'Laporan', href: '/admin/inventory/reports' },
      ]}
    >
      {children}
    </TabLayout>
  );
}
