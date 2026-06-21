'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Home, Package, ShoppingCart, Settings, LogOut, Coins, Loader2, Receipt } from 'lucide-react';
import { logoutAction } from '@/actions/auth';
import { triggerLoader } from '@/components/layouts/navigation-loader';
import { PlanBadge } from '@/components/plan/plan-badge';

interface SubNavItem {
  href: string;
  label: string;
}

interface NavItem {
  href: string;
  label: string;
  mobileLabel: string;
  icon: React.ReactNode;
  matchPaths?: string[];
  subItems?: SubNavItem[];
}

interface NavigationProps {
  role: 'ADMINISTRATOR' | 'MANAGER' | 'CASHIER' | 'MEMBER';
  userName?: string;
  storeSlug: string;
  storeName?: string;
  storePlan?: 'FREE' | 'PRO';
  logoUrl?: string | null;
}

export function Navigation({ role, userName, storeSlug, storeName, storePlan = 'FREE', logoUrl }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const base = `/${storeSlug}`;
  const homeHref =
    role === 'ADMINISTRATOR' ? `${base}/admin` :
    role === 'MANAGER'       ? `${base}/manager` :
    role === 'CASHIER'       ? `${base}/cashier` :
    `${base}/member`;

  const adminNavItems: NavItem[] = [
    {
      href: `${base}/admin`,
      label: 'Dashboard',
      mobileLabel: 'Dashboard',
      icon: <Home className="w-4 h-4" />,
      matchPaths: [`${base}/admin/summary`],
      subItems: [
        { href: `${base}/admin`,     label: 'POS Kasir' },
        { href: `${base}/admin/summary`, label: 'Ringkasan' },
      ],
    },
    {
      href: `${base}/admin/inventory/products`,
      label: 'Inventori',
      mobileLabel: 'Inventori',
      icon: <Package className="w-4 h-4" />,
      matchPaths: [
        `${base}/admin/inventory/products`,
        `${base}/admin/inventory/stock`,
        `${base}/admin/inventory/reports`,
      ],
      subItems: [
        { href: `${base}/admin/inventory/products`, label: 'Produk' },
        { href: `${base}/admin/inventory/stock`,    label: 'Stok' },
        { href: `${base}/admin/inventory/reports`,  label: 'Laporan' },
      ],
    },
    {
      href: `${base}/admin/transactions/sales`,
      label: 'Transaksi',
      mobileLabel: 'Transaksi',
      icon: <ShoppingCart className="w-4 h-4" />,
      matchPaths: [
        `${base}/admin/transactions/sales`,
        `${base}/admin/transactions/customers`,
        `${base}/admin/transactions/recap`,
      ],
      subItems: [
        { href: `${base}/admin/transactions/sales`,     label: 'Penjualan' },
        { href: `${base}/admin/transactions/customers`, label: 'Customer' },
        { href: `${base}/admin/transactions/recap`,     label: 'Rekap' },
      ],
    },
    {
      href: `${base}/admin/finance/cashflow`,
      label: 'Keuangan',
      mobileLabel: 'Keuangan',
      icon: <Coins className="w-4 h-4" />,
      matchPaths: [
        `${base}/admin/finance/cashflow`,
        `${base}/admin/finance/reports`,
      ],
      subItems: [
        { href: `${base}/admin/finance/cashflow`, label: 'Cashflow' },
        { href: `${base}/admin/finance/reports`,  label: 'Laporan Keuangan' },
      ],
    },
    {
      href: `${base}/admin/settings/points`,
      label: 'Pengaturan',
      mobileLabel: 'Setelan',
      icon: <Settings className="w-4 h-4" />,
      matchPaths: [
        `${base}/admin/settings/points`,
        `${base}/admin/settings/categories`,
        `${base}/admin/settings/profile`,
      ],
      subItems: [
        { href: `${base}/admin/settings/points`,     label: 'Sistem Poin' },
        { href: `${base}/admin/settings/categories`, label: 'Kategori' },
        { href: `${base}/admin/settings/profile`,    label: 'Profil Admin' },
      ],
    },
  ];

  const managerNavItems: NavItem[] = [
    {
      href: `${base}/manager`,
      label: 'Dashboard',
      mobileLabel: 'Dashboard',
      icon: <Home className="w-4 h-4" />,
    },
    {
      href: `${base}/manager/transactions/sales`,
      label: 'Transaksi',
      mobileLabel: 'Transaksi',
      icon: <ShoppingCart className="w-4 h-4" />,
      matchPaths: [
        `${base}/manager/transactions/sales`,
        `${base}/manager/transactions/customers`,
        `${base}/manager/transactions/recap`,
      ],
      subItems: [
        { href: `${base}/manager/transactions/sales`,     label: 'Penjualan' },
        { href: `${base}/manager/transactions/customers`, label: 'Customer' },
        { href: `${base}/manager/transactions/recap`,     label: 'Rekap' },
      ],
    },
    {
      href: `${base}/manager/inventory/products`,
      label: 'Inventori',
      mobileLabel: 'Inventori',
      icon: <Package className="w-4 h-4" />,
      matchPaths: [
        `${base}/manager/inventory/products`,
        `${base}/manager/inventory/stock`,
      ],
      subItems: [
        { href: `${base}/manager/inventory/products`, label: 'Produk' },
        { href: `${base}/manager/inventory/stock`,    label: 'Kelola Stok' },
      ],
    },
  ];

  const cashierNavItems: NavItem[] = [
    {
      href: `${base}/cashier`,
      label: 'POS Kasir',
      mobileLabel: 'POS',
      icon: <ShoppingCart className="w-4 h-4" />,
    },
    {
      href: `${base}/cashier/transactions`,
      label: 'Transaksi Saya',
      mobileLabel: 'Transaksi',
      icon: <Receipt className="w-4 h-4" />,
      matchPaths: [
        `${base}/cashier/transactions`,
        `${base}/cashier/transactions/customers`,
      ],
      subItems: [
        { href: `${base}/cashier/transactions`,           label: 'Penjualan' },
        { href: `${base}/cashier/transactions/customers`, label: 'Customer' },
      ],
    },
  ];

  const memberNavItems: NavItem[] = [
    {
      href: `${base}/member`,
      label: 'My Points',
      mobileLabel: 'Points',
      icon: <Home className="w-4 h-4" />,
    },
    {
      href: `${base}/member/purchases`,
      label: 'Riwayat Belanja',
      mobileLabel: 'Riwayat',
      icon: <ShoppingCart className="w-4 h-4" />,
    },
  ];

  const navItems =
    role === 'ADMINISTRATOR' ? adminNavItems :
    role === 'MANAGER'       ? managerNavItems :
    role === 'CASHIER'       ? cashierNavItems :
    memberNavItems;

  const isNavItemActive = (item: NavItem) => {
    if (pathname === item.href) return true;
    if (item.matchPaths) return item.matchPaths.some((path) => pathname.startsWith(path));
    return false;
  };

  return (
    <>
      {/* ── DESKTOP SIDEBAR (lg dan ke atas) ── */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-64 bg-white/95 border-r border-[#a8f0f8] shadow-md backdrop-blur-sm">
        {/* Logo + Store name */}
        <div className="flex items-center gap-3 h-16 px-4 border-b border-[#a8f0f8] flex-shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName ?? 'Logo'} className="w-8 h-8 rounded-lg object-contain flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#028697] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{(storeName ?? 'C').charAt(0).toUpperCase()}</span>
            </div>
          )}
          <Link
            href={homeHref}
            className="text-sm font-bold text-[#028697] truncate hover:opacity-80 transition-opacity leading-tight"
          >
            {storeName ?? 'Catat Bisnisku'}
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item);
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    relative group flex items-center gap-3 px-3 py-2.5 rounded-lg
                    font-medium text-sm transition-all duration-200
                    ${isActive
                      ? 'bg-[#028697] text-white shadow-md'
                      : 'text-gray-600 hover:text-[#028697] hover:bg-[#e0f9fc]'
                    }
                  `}
                >
                  <span className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>

                {item.subItems && (() => {
                  // Sub-items selalu ditampilkan (expanded) di desktop sidebar.
                  // Pilih sub-item paling spesifik yang cocok dengan path saat ini.
                  // Perlu karena href Ringkasan ("/admin/summary") adalah prefix dari
                  // href POS Kasir ("/admin") — tanpa ini keduanya akan
                  // ke-highlight bersamaan saat berada di halaman POS Kasir.
                  const matchedSub = isActive
                    ? [...item.subItems]
                        .sort((a, b) => b.href.length - a.href.length)
                        .find((sub) => pathname === sub.href || pathname.startsWith(sub.href))
                    : undefined;

                  return (
                    <div className="mt-1 mb-1 ml-[1.15rem] pl-4 border-l-2 border-[#a8f0f8] space-y-0.5">
                      {item.subItems.map((sub) => {
                        const subActive = matchedSub?.href === sub.href;
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={`
                              block px-3 py-1.5 rounded-md text-sm truncate transition-colors duration-150
                              ${subActive
                                ? 'bg-[#e0f9fc] text-[#028697] font-medium'
                                : 'text-gray-500 hover:text-[#028697] hover:bg-[#e0f9fc]/60'
                              }
                            `}
                          >
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="flex-shrink-0 border-t border-[#a8f0f8] p-4 space-y-3">
          <div className="text-sm">
            <p className="font-medium text-gray-900 truncate">{userName ?? 'User'}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#e0f9fc] text-[#0fa8be] whitespace-nowrap">
                {role}
              </span>
              <PlanBadge plan={storePlan} storeSlug={storeSlug} compact />
            </div>
          </div>

          <form action={logoutAction}>
            <Button
              variant="outline"
              size="sm"
              type="submit"
              className="w-full group relative overflow-hidden border-[#a8f0f8] text-[#028697] hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all duration-300 hover:shadow-md"
            >
              <LogOut className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-12" />
              Logout
            </Button>
          </form>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR (di bawah lg) ── */}
      <nav className="lg:hidden bg-white/95 border-b border-[#a8f0f8] sticky top-0 z-40 shadow-md backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">

            {/* Logo */}
            <div className="flex items-center flex-1 min-w-0 gap-3 sm:gap-4">
              <div className="flex-shrink-0">
                <Link href={homeHref} className="text-lg font-bold text-[#028697] whitespace-nowrap hover:opacity-80 transition-opacity">
                  {storeName ?? 'Catat Bisnisku'}
                </Link>
              </div>
            </div>

            {/* Mobile – user info + logout */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-gray-700 max-w-[90px] truncate leading-tight">
                  {userName ?? 'User'}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[#e0f9fc] text-[#028697] leading-tight">
                  {role}
                </span>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 active:bg-red-200 transition-colors duration-150"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>

          </div>
        </div>
      </nav>

      {/* ── MOBILE BOTTOM NAV BAR ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="mx-3 mb-3 pointer-events-auto rounded-2xl bg-white/90 backdrop-blur-md border border-[#c8f4f9] shadow-[0_-4px_28px_rgba(2,134,151,0.15)]">
          <div className="flex items-stretch justify-around px-1 py-1.5">
            {navItems.map((item) => {
              const isActive = isNavItemActive(item);
              const isLoading = isPending && pendingHref === item.href;
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    if (pathname === item.href || isLoading) return;
                    setPendingHref(item.href);
                    triggerLoader();
                    startTransition(() => {
                      router.push(item.href);
                    });
                  }}
                  className="relative flex flex-col items-center justify-center gap-1 flex-1 py-2 px-1 rounded-xl transition-all duration-200 group"
                >
                  {isActive && (
                    <span className="absolute inset-0 rounded-xl bg-[#028697] shadow-md" />
                  )}
                  {!isActive && (
                    <span className="absolute inset-0 rounded-xl opacity-0 group-active:opacity-100 group-hover:opacity-100 bg-[#e0f9fc] transition-opacity duration-150" />
                  )}
                  <span className={`relative z-10 transition-all duration-200 ${
                    isActive
                      ? 'text-white scale-110'
                      : 'text-gray-400 group-hover:text-[#028697] group-active:scale-110'
                  }`}>
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <span className="[&>svg]:w-5 [&>svg]:h-5">{item.icon}</span>
                    )}
                  </span>
                  <span className={`relative z-10 text-[9px] font-semibold leading-none tracking-wide transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-[#028697]'
                  }`}>
                    {item.mobileLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}