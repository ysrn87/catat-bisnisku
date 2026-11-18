import Link from 'next/link';
import { LogOut, ScrollText, Settings2, Store } from 'lucide-react';
import { requireSuperAdminPage } from '@/lib/superadmin';
import { superAdminLogoutAction } from '@/actions/superadmin-auth';

const NAV = [
  { href: '/superadmin',        label: 'Toko',        icon: Store },
  { href: '/superadmin/plans',  label: 'Batas Paket', icon: Settings2 },
  { href: '/superadmin/audit',  label: 'Riwayat',     icon: ScrollText },
];

export default async function SuperAdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireSuperAdminPage();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">Superadmin</span>
            <nav className="flex items-center gap-1">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 hover:text-white"
                >
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-300 sm:inline">{admin.email}</span>
            <form action={superAdminLogoutAction}>
              <button type="submit" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-slate-200 hover:bg-slate-700 hover:text-white">
                <LogOut className="h-4 w-4" /> Keluar
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
