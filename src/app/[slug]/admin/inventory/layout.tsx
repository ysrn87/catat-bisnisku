import { TabLayout } from '@/components/layouts/tab-layout';

export default async function InventoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <TabLayout
      title="Manajemen Inventori"
      description="Kelola produk, stok, dan laporan inventori"
      tabs={[
        { value: 'products', label: 'Produk',  href: `/${slug}/admin/inventory/products` },
        { value: 'stock',    label: 'Stok',    href: `/${slug}/admin/inventory/stock` },
        { value: 'reports',  label: 'Laporan', href: `/${slug}/admin/inventory/reports` },
      ]}
    >
      {children}
    </TabLayout>
  );
}
