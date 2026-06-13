'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Home, Package, ShoppingCart, Settings, LogOut, Coins } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { logoutAction } from '@/actions/auth';
import { PlanBadge } from '@/components/plan/plan-badge';

interface NavItem {
  href: string;
  label: string;
  mobileLabel: string;
  icon: React.ReactNode;
  matchPaths?: string[];
}

interface NavigationProps {
  role: 'ADMINISTRATOR' | 'MANAGER' | 'MEMBER';
  userName?: string;
  storeSlug: string;
  storeName?: string;
  storePlan?: 'FREE' | 'PRO';
}

type CompactLevel = 'full' | 'medium' | 'compact' | 'icons-only';

export function Navigation({ role, userName, storeSlug, storeName, storePlan = 'FREE' }: NavigationProps) {
  const pathname = usePathname();
  const [compactLevel, setCompactLevel] = useState<CompactLevel>('full');
  const navContainerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const base = `/${storeSlug}`;

  const adminNavItems: NavItem[] = [
    {
      href: `${base}/admin`,
      label: 'Dashboard',
      mobileLabel: 'Dashboard',
      icon: <Home className="w-4 h-4" />,
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
    },
    {
      href: `${base}/admin/sales-customers/sales`,
      label: 'Penjualan & Pelanggan',
      mobileLabel: 'Penjualan',
      icon: <ShoppingCart className="w-4 h-4" />,
      matchPaths: [
        `${base}/admin/sales-customers/sales`,
        `${base}/admin/sales-customers/customers`,
        `${base}/admin/sales-customers/recap`,
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
    },
    {
      href: `${base}/admin/settings/points`,
      label: 'Pengaturan',
      mobileLabel: 'Setelan',
      icon: <Settings className="w-4 h-4" />,
      matchPaths: [
        `${base}/admin/settings/points`,
        `${base}/admin/settings/profile`,
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
      href: `${base}/manager/sales-customers/sales`,
      label: 'Penjualan & Pelanggan',
      mobileLabel: 'Penjualan',
      icon: <ShoppingCart className="w-4 h-4" />,
      matchPaths: [
        `${base}/manager/sales-customers/sales`,
        `${base}/manager/sales-customers/customers`,
        `${base}/manager/sales-customers/recap`,
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
    memberNavItems;

  const isNavItemActive = (item: NavItem) => {
    if (pathname === item.href) return true;
    if (item.matchPaths) return item.matchPaths.some((path) => pathname.startsWith(path));
    return false;
  };

  useEffect(() => {
    const checkNavSpace = () => {
      if (!navContainerRef.current) return;
      const container = navContainerRef.current;
      const containerWidth = container.offsetWidth;
      const screenWidth = window.innerWidth;
      const userInfoWidth = screenWidth >= 1280 ? 280 : screenWidth >= 1024 ? 160 : 0;
      const availableNavWidth = containerWidth - userInfoWidth;
      const itemCount = navItems.length;

      if (availableNavWidth >= itemCount * 140)      setCompactLevel('full');
      else if (availableNavWidth >= itemCount * 100) setCompactLevel('medium');
      else if (availableNavWidth >= itemCount * 75)  setCompactLevel('compact');
      else                                           setCompactLevel('icons-only');
    };

    const handleResize = () => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(checkNavSpace, 50);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (navContainerRef.current) resizeObserver.observe(navContainerRef.current);

    checkNavSpace();
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, [navItems.length]);

  const getNavItemStyles = () => {
    switch (compactLevel) {
      case 'full':       return { gap: 'gap-2',   padding: 'px-4 py-2', textWidth: 'w-auto', textOpacity: 'opacity-100' };
      case 'medium':     return { gap: 'gap-2',   padding: 'px-3 py-2', textWidth: 'w-auto', textOpacity: 'opacity-100' };
      case 'compact':    return { gap: 'gap-1.5', padding: 'px-2 py-2', textWidth: 'w-auto', textOpacity: 'opacity-100' };
      case 'icons-only': return { gap: 'gap-1',   padding: 'p-2.5',     textWidth: 'w-0',    textOpacity: 'opacity-0'   };
    }
  };

  const navStyles = getNavItemStyles();
  const showTooltip = compactLevel === 'icons-only';

  return (
    <>
      {/* ── TOP NAV ── */}
      <nav className="bg-white/95 border-b border-[#a8f0f8] sticky top-0 z-40 shadow-md backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">

            {/* Left – Logo + Desktop Nav */}
            <div className="flex items-center flex-1 min-w-0 gap-3 sm:gap-4 lg:gap-6">
              <div className="flex-shrink-0">
                <Link href={`${base}/admin`} className="text-lg font-bold text-[#028697] whitespace-nowrap hover:opacity-80 transition-opacity">
                  {storeName ?? 'Catat Bisnisku'}
                </Link>
              </div>

              {/* Desktop nav links */}
              <div
                ref={navContainerRef}
                className="hidden lg:flex flex-1 items-center overflow-x-auto scrollbar-hide"
              >
                <div className={`flex items-center transition-all duration-500 ease-in-out ${navStyles.gap}`}>
                  {navItems.map((item) => {
                    const isActive = isNavItemActive(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={showTooltip ? item.label : undefined}
                        className={`
                          relative z-10 group inline-flex items-center justify-center
                          font-medium rounded-lg transition-all duration-500 ease-in-out
                          ${navStyles.gap} ${navStyles.padding}
                          ${isActive
                            ? 'bg-[#028697] text-white shadow-lg scale-105'
                            : 'text-gray-600 hover:text-[#028697] hover:bg-[#e0f9fc] hover:scale-105'
                          }
                        `}
                      >
                        <span className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                          {item.icon}
                        </span>
                        <span className={`
                          whitespace-nowrap font-medium overflow-hidden
                          transition-all duration-500 ease-in-out
                          ${navStyles.textWidth} ${navStyles.textOpacity}
                          ${compactLevel === 'compact' ? 'text-xs' : 'text-sm'}
                        `}>
                          {item.label}
                        </span>
                        <span className={`
                          absolute inset-0 -z-10 rounded-lg
                          group-hover:opacity-100 transition-opacity duration-300
                          ${isActive ? 'bg-white/10' : 'bg-[#028697]/5'}
                        `} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right – Desktop: user info + logout */}
            <div className={`
              hidden lg:flex items-center flex-shrink-0
              transition-all duration-500 ease-in-out
              ${compactLevel === 'icons-only' ? 'gap-1 ml-2' :
                compactLevel === 'compact'    ? 'gap-2 ml-3' : 'gap-3 ml-6'}
            `}>
              <div className={`
                text-sm text-right transition-all duration-500 ease-in-out overflow-hidden
                ${compactLevel === 'icons-only' ? 'w-0 opacity-0' : 'opacity-100'}
              `}>
                <p className={`
                  font-medium text-gray-900 whitespace-nowrap transition-all duration-300
                  ${compactLevel === 'medium' ? 'text-xs' : 'text-sm'}
                  hidden xl:block
                `}>
                  {userName ?? 'User'}
                </p>
                <span className={`
                  inline-flex items-center px-2 py-0.5 rounded-full font-medium
                  bg-[#e0f9fc] text-[#0fa8be] whitespace-nowrap
                  transition-all duration-300
                  ${compactLevel === 'medium' ? 'text-[10px]' : 'text-xs'}
                `}>
                  {role}
                </span>
                <PlanBadge plan={storePlan} storeSlug={storeSlug} compact />
              </div>

              <form action={logoutAction}>
                <Button
                  variant="outline"
                  size="sm"
                  type="submit"
                  className={`
                    group relative overflow-hidden whitespace-nowrap
                    border-[#a8f0f8] text-[#028697]
                    hover:bg-red-50 hover:border-red-300 hover:text-red-600
                    transition-all duration-500 ease-in-out
                    ${compactLevel === 'icons-only' ? 'px-2' : 'px-3'}
                    hover:scale-105 hover:shadow-md
                  `}
                >
                  <LogOut className={`
                    w-4 h-4 transition-all duration-300
                    ${compactLevel === 'icons-only' ? '' : 'xl:mr-2'}
                    group-hover:rotate-12
                  `} />
                  <span className={`
                    transition-all duration-500 ease-in-out overflow-hidden inline-block
                    ${compactLevel === 'icons-only' ? 'w-0 opacity-0' : 'w-0 opacity-0 xl:w-auto xl:opacity-100'}
                  `}>
                    Logout
                  </span>
                </Button>
              </form>
            </div>

            {/* Mobile – user info + logout */}
            <div className="flex lg:hidden items-center gap-2">
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
              return (
                <Link
                  key={item.href}
                  href={item.href}
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
                    <span className="[&>svg]:w-5 [&>svg]:h-5">{item.icon}</span>
                  </span>
                  <span className={`relative z-10 text-[9px] font-semibold leading-none tracking-wide transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-[#028697]'
                  }`}>
                    {item.mobileLabel}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
