import { TabLayout } from '@/components/layouts/tab-layout';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <TabLayout
      title="Pengaturan"
      description="Kelola sistem poin dan profil admin"
      tabs={[
        { value: 'points',  label: 'Sistem Poin', href: '/admin/settings/points' },
        { value: 'profile', label: 'Profil Admin', href: '/admin/settings/profile' },
      ]}
    >
      {children}
    </TabLayout>
  );
}
