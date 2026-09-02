import { TabLayout } from '@/components/layouts/tab-layout';

export default async function AccountingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <TabLayout
      title="Akuntansi"
      description="Laporan keuangan berbasis double-entry accounting"
      tabs={[
        { value: 'profit-loss', label: 'Laba Rugi',  href: `/${slug}/admin/accounting/profit-loss` },
        { value: 'journal',     label: 'Jurnal',      href: `/${slug}/admin/accounting/journal` },
        { value: 'ledger',      label: 'Buku Besar',  href: `/${slug}/admin/accounting/ledger` },
        { value: 'sak-report',  label: 'Laporan SAK', href: `/${slug}/admin/accounting/sak-report` },
        { value: 'accounts',    label: 'Kelola Akun', href: `/${slug}/admin/accounting/accounts` },
      ]}
    >
      {children}
    </TabLayout>
  );
}
