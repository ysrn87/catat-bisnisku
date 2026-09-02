'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Home, Package, ShoppingCart, Settings, LogOut, Coins, Loader2, Receipt, ChevronDown, Search, Bell, Zap, Crown, BookMarked } from 'lucide-react';
import { logoutAction } from '@/actions/auth';
import { triggerLoader } from '@/components/layouts/navigation-loader';
import { PlanBadge } from '@/components/plan/plan-badge';

interface SubNavItem {
  href: string;
  label: string;
  group?: string; // label pemisah grup, tampil sebelum item ini
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
  role: 'OWNER' | 'ADMINISTRATOR' | 'MANAGER' | 'CASHIER' | 'MEMBER';
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
  const [expandedHref, setExpandedHref] = useState<string | null>(null);

  const base = `/${storeSlug}`;
  const homeHref =
    role === 'OWNER'         ? `${base}/admin` :
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
      href: `${base}/admin/accounting/profit-loss`,
      label: 'Akuntansi',
      mobileLabel: 'Akuntansi',
      icon: <BookMarked className="w-4 h-4" />,
      matchPaths: [
        `${base}/admin/accounting`,
      ],
      subItems: [
        { href: `${base}/admin/accounting/profit-loss`, label: 'Laba Rugi' },
        { href: `${base}/admin/accounting/journal`,     label: 'Jurnal' },
        { href: `${base}/admin/accounting/ledger`,      label: 'Buku Besar' },
        { href: `${base}/admin/accounting/sak-report`,  label: 'Laporan SAK' },
        { href: `${base}/admin/accounting/accounts`,    label: 'Kelola Akun' },
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
        `${base}/admin/settings/subscription`,
      ],
      subItems: [
        { href: `${base}/admin/settings/points`,       label: 'Poin' },
        { href: `${base}/admin/settings/categories`,   label: 'Kategori' },
        { href: `${base}/admin/settings/profile`,      label: 'Profil' },
        { href: `${base}/admin/settings/subscription`, label: 'Langganan' },
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

  useEffect(() => {
    const active = navItems.find((item) => isNavItemActive(item) && item.subItems);
    setExpandedHref(active ? active.href : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const activeItem = navItems.find((item) => isNavItemActive(item));
  const activeSub = activeItem?.subItems?.find(
    (sub) => pathname === sub.href || pathname.startsWith(sub.href)
  );

  return (
    <>
      {/* ── DESKTOP SIDEBAR (lg dan ke atas) ── */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-60 bg-white border-r border-gray-100">
        {/* Logo + Store name */}
        <div className="flex items-center gap-2.5 h-16 px-5 border-b border-gray-100 flex-shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName ?? 'Logo'} className="w-7 h-7 rounded-lg object-contain flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-[#028697] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-medium">{(storeName ?? 'C').charAt(0).toUpperCase()}</span>
            </div>
          )}
          <Link
            href={homeHref}
            className="text-sm font-medium text-gray-900 truncate hover:opacity-80 transition-opacity leading-tight"
          >
            {storeName ?? 'Catat Bisnisku'}
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-0.5">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item);
            const hasSub = !!item.subItems;
            const isExpanded = expandedHref === item.href;

            const matchedSub = isActive && item.subItems
              ? [...item.subItems]
                  .sort((a, b) => b.href.length - a.href.length)
                  .find((sub) => pathname === sub.href || pathname.startsWith(sub.href))
              : undefined;

            return (
              <div key={item.href}>
                {hasSub ? (
                  <button
                    type="button"
                    onClick={() => setExpandedHref(isExpanded ? null : item.href)}
                    className={`
                      w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg
                      text-sm transition-colors duration-150
                      ${isActive
                        ? 'bg-gray-50 text-gray-900 font-medium'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      }
                    `}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className={`flex-shrink-0 ${isActive ? 'text-[#028697]' : ''}`}>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (pathname === item.href || (isPending && pendingHref === item.href)) return;
                      setPendingHref(item.href);
                      triggerLoader();
                      startTransition(() => { router.push(item.href); });
                    }}
                    className={`
                      w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg
                      text-sm transition-colors duration-150
                      ${isActive
                        ? 'bg-gray-50 text-gray-900 font-medium'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      }
                    `}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className={`flex-shrink-0 ${isActive ? 'text-[#028697]' : ''}`}>
                        {isPending && pendingHref === item.href
                          ? <Loader2 className="w-4 h-4 animate-spin text-[#028697]" />
                          : item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                  </button>
                )}

                {hasSub && isExpanded && (
                  <div className="mt-0.5 mb-1 ml-[1.65rem] pl-3 flex flex-col gap-0.5">
                    {item.subItems!.map((sub) => {
                      const subActive = matchedSub?.href === sub.href;
                      const subLoading = isPending && pendingHref === sub.href;
                      return (
                        <div key={sub.href}>
                          {sub.group && (
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 px-3 pt-2 pb-0.5 select-none">
                              {sub.group}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (pathname === sub.href || subLoading) return;
                              setPendingHref(sub.href);
                              triggerLoader();
                              startTransition(() => { router.push(sub.href); });
                            }}
                            className={`
                              flex items-center justify-between py-1.5 pl-3 pr-2 text-sm truncate transition-colors duration-150 border-l-2 text-left w-full
                              ${subActive
                                ? 'border-[#028697] text-[#028697] font-medium'
                                : 'border-gray-100 text-gray-400 hover:text-gray-700 hover:border-gray-300'
                              }
                            `}
                          >
                            <span className="truncate">{sub.label}</span>
                            {subLoading && <Loader2 className="w-3 h-3 animate-spin flex-shrink-0 ml-1.5 text-[#028697]" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="flex-shrink-0 border-t border-gray-100 p-4 space-y-3">
          <div className="text-sm">
            <p className="font-medium text-gray-900 truncate">{userName ?? 'User'}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500 whitespace-nowrap">
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
              className="w-full group relative overflow-hidden border-gray-200 text-gray-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors duration-200"
            >
              <LogOut className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-12" />
              Logout
            </Button>
          </form>
        </div>
      </aside>

      {/* ── DESKTOP TOPBAR (lg dan ke atas) ── */}
      <header className="hidden lg:flex lg:fixed lg:top-0 lg:left-60 lg:right-0 lg:z-30 h-16 items-center justify-between gap-4 px-8 bg-white border-b border-gray-100">
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          <span className="text-gray-400 truncate">{activeItem?.label ?? 'Dashboard'}</span>
          {activeSub && (
            <>
              <span className="text-gray-300">/</span>
              <span className="text-gray-900 font-medium truncate">{activeSub.label}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="relative hidden xl:block w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari di sini..."
              disabled
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-gray-50 border border-gray-100 text-gray-400 placeholder:text-gray-400 cursor-not-allowed"
            />
          </div>
          <Bell className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
          <div className="w-px h-5 bg-gray-100" />
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="text-right min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate max-w-[140px]">{userName ?? 'User'}</p>
              <p className="text-xs text-gray-400 truncate">{role}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-[#028697]">
                {(userName ?? 'U').charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </header>

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

            {/* Mobile – upgrade button (FREE plan only, OWNER/ADMIN) */}
            {storePlan === 'FREE' && (role === 'OWNER' || role === 'ADMINISTRATOR') && (
              <Link
                href={`/${storeSlug}/admin/settings/subscription`}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 active:bg-amber-200 transition-colors duration-150 flex-shrink-0"
              >
                <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                <span className="text-[10px] font-bold whitespace-nowrap">Upgrade PRO</span>
              </Link>
            )}
            {storePlan === 'PRO' && (
              <Link
                href={`/${storeSlug}/admin/settings/subscription`}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 active:bg-amber-200 transition-colors duration-150 flex-shrink-0"
              >
                <Crown className="w-3 h-3 fill-amber-500 text-amber-500" />
                <span className="text-[10px] font-bold">PRO</span>
              </Link>
            )}

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