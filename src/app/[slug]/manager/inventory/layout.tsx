import { TabLayout } from '@/components/layouts/tab-layout';

export default async function ManagerInventoryLayout({
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
      description="Lihat produk dan kelola stok"
      tabs={[
        { value: 'products', label: 'Produk',      href: `/${slug}/manager/inventory/products` },
        { value: 'stock',    label: 'Kelola Stok', href: `/${slug}/manager/inventory/stock` },
      ]}
    >
      {children}
    </TabLayout>
  );
}
