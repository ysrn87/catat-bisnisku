import { TabLayout } from '@/components/layouts/tab-layout';

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <TabLayout
      title="Keuangan"
      description="Kelola cashflow dan laporan keuangan"
      tabs={[
        { value: 'cashflow', label: 'Cashflow',         href: '/admin/finance/cashflow' },
        { value: 'reports',  label: 'Laporan Keuangan', href: '/admin/finance/reports' },
      ]}
    >
      {children}
    </TabLayout>
  );
}
