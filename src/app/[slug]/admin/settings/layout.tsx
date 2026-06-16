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
      description="Kelola sistem poin, kategori produk, dan profil admin"
      tabs={[
        { value: 'points',     label: 'Sistem Poin',  href: `/${slug}/admin/settings/points` },
        { value: 'categories', label: 'Kategori',     href: `/${slug}/admin/settings/categories` },
        { value: 'profile',    label: 'Profil Admin', href: `/${slug}/admin/settings/profile` },
      ]}
    >
      {children}
    </TabLayout>
  );
}
