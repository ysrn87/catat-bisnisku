import { TabLayout } from '@/components/layouts/tab-layout';

export default function ManagerInventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <TabLayout
      title="Manajemen Inventori"
      description="Lihat produk dan kelola stok"
      tabs={[
        { value: 'products', label: 'Produk',      href: '/manager/inventory/products' },
        { value: 'stock',    label: 'Kelola Stok', href: '/manager/inventory/stock' },
      ]}
    >
      {children}
    </TabLayout>
  );
}
