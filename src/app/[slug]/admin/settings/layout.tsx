import { TabLayout } from '@/components/layouts/tab-layout';

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <TabLayout
      title="Pengaturan"
      description="Kelola sistem poin, kategori produk, profil admin, dan langganan"
      tabs={[
        { value: 'points',        label: 'Poin',  href: `/${slug}/admin/settings/points` },
        { value: 'categories',    label: 'Kategori',     href: `/${slug}/admin/settings/categories` },
        { value: 'profile',       label: 'Profil', href: `/${slug}/admin/settings/profile` },
        { value: 'subscription',  label: 'Langganan',    href: `/${slug}/admin/settings/subscription` },
      ]}
    >
      {children}
    </TabLayout>
  );
}
