'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useTransition, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Home, Package, ShoppingCart, Settings, LogOut, Coins, Loader2, Receipt, ChevronDown, Search, PanelLeftClose, PanelLeftOpen, Zap, Crown, BookMarked } from 'lucide-react';
import { logoutAction } from '@/actions/auth';
import { triggerLoader } from '@/components/layouts/navigation-loader';
import { PlanBadge } from '@/components/plan/plan-badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CommandPalette, type PaletteEntry } from '@/components/command-palette';
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed';
import { cn } from '@/lib/utils';

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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { collapsed, toggle: toggleSidebar } = useSidebarCollapsed();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

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
        `${base}/admin/inventory/combos`,
        `${base}/admin/inventory/stock`,
        `${base}/admin/inventory/reports`,
      ],
      subItems: [
        { href: `${base}/admin/inventory/products`, label: 'Produk' },
        { href: `${base}/admin/inventory/combos`,   label: 'Paket' },
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
        `${base}/admin/settings/payment`,
        `${base}/admin/settings/subscription`,
        `${base}/admin/settings/danger`,
      ],
      subItems: [
        { href: `${base}/admin/settings/points`,       label: 'Poin' },
        { href: `${base}/admin/settings/categories`,   label: 'Kategori' },
        { href: `${base}/admin/settings/profile`,      label: 'Profil' },
        { href: `${base}/admin/settings/payment`,      label: 'Pembayaran' },
        { href: `${base}/admin/settings/subscription`, label: 'Langganan' },
        { href: `${base}/admin/settings/danger`,       label: 'Hapus Toko' },
      ],
    },
  ];

  const managerNavItems: NavItem[] = [
    {
      href: `${base}/manager`,
      label: 'Dashboard',
      mobileLabel: 'Dashboard',
      icon: <Home className="w-4 h-4" />,
      matchPaths: [`${base}/manager/summary`],
      subItems: [
        { href: `${base}/manager`,         label: 'POS Kasir' },
        { href: `${base}/manager/summary`, label: 'Ringkasan' },
      ],
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
        `${base}/manager/inventory/combos`,
        `${base}/manager/inventory/stock`,
      ],
      subItems: [
        { href: `${base}/manager/inventory/products`, label: 'Produk' },
        { href: `${base}/manager/inventory/combos`,   label: 'Paket' },
        { href: `${base}/manager/inventory/stock`,    label: 'Kelola Stok' },
      ],
    },
  ];

  const cashierNavItems: NavItem[] = [
    {
      href: `${base}/cashier`,
      label: 'Dashboard',
      mobileLabel: 'Dashboard',
      icon: <Home className="w-4 h-4" />,
      matchPaths: [`${base}/cashier/summary`],
      subItems: [
        { href: `${base}/cashier`,         label: 'POS Kasir' },
        { href: `${base}/cashier/summary`, label: 'Ringkasan Saya' },
      ],
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

  // Sub-item aktif = kecocokan TERPANJANG (mis. /admin/summary menang atas /admin) dan
  // dibatasi segmen path (/stock tidak cocok dengan /stock-opname). Dipakai sidebar & breadcrumb.
  const findActiveSub = (item?: NavItem) =>
    item?.subItems
      ? [...item.subItems]
          .sort((a, b) => b.href.length - a.href.length)
          .find((sub) => pathname === sub.href || pathname.startsWith(`${sub.href}/`))
      : undefined;

  const activeItem = navItems.find((item) => isNavItemActive(item));
  const activeSub = findActiveSub(activeItem);

  // Pengelompokan menu sidebar desktop (khusus admin) — hanya tampilan, tidak mengubah rute.
  const ADMIN_GROUPS: Record<string, string> = {
    Dashboard: 'Operasional', Inventori: 'Operasional', Transaksi: 'Operasional',
    Keuangan: 'Keuangan', Akuntansi: 'Keuangan',
    Pengaturan: 'Sistem',
  };
  const groupOf = (item?: NavItem) => (role === 'ADMINISTRATOR' && item ? ADMIN_GROUPS[item.label] : undefined);
  const isDangerSub = (sub: SubNavItem) => sub.href.endsWith('/settings/danger');

  const ROLE_LABELS: Record<NavigationProps['role'], string> = {
    OWNER: 'Pemilik', ADMINISTRATOR: 'Administrator', MANAGER: 'Manajer', CASHIER: 'Kasir', MEMBER: 'Member',
  };
  const roleLabel = ROLE_LABELS[role] ?? role;

  // Pintasan Ctrl/Cmd + K membuka pencarian halaman.
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Daftar halaman untuk pencarian: submenu diutamakan, menu tanpa submenu berdiri sendiri.
  const paletteEntries: PaletteEntry[] = navItems.flatMap((item) =>
    item.subItems
      ? item.subItems.map((sub) => ({ href: sub.href, label: sub.label, section: item.label, icon: item.icon }))
      : [{ href: item.href, label: item.label, icon: item.icon }]
  );

  // Spinner & menu pengguna di-reset begitu rute berpindah.
  useEffect(() => {
    setPendingHref(null);
    setUserMenuOpen(false);
  }, [pathname]);

  // Klik link navigasi: biarkan Ctrl/Cmd/Shift-klik (tab baru) lewat apa adanya;
  // klik biasa menampilkan loader, dan klik ke halaman yang sedang dibuka diabaikan.
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (pathname === href) { e.preventDefault(); return; }
    setPendingHref(href);
    triggerLoader();
  };

  return (
    <>
      {/* ── DESKTOP SIDEBAR (lg dan ke atas) ──
          Lebar mengikuti --sidebar-w (15rem normal, 4rem saat diciutkan; lihat globals.css).
          Saat diciutkan, teks disembunyikan lewat CSS (html[data-sidebar=collapsed]) agar tidak berkedip
          sebelum hidrasi; struktur interaktif (tooltip / menu submenu) dipilih lewat state `collapsed`. */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-[var(--sidebar-w)] overflow-hidden bg-white border-r border-gray-100 transition-[width] duration-200 ease-out">
        {/* Logo + Store name */}
        <div className="flex h-16 flex-shrink-0 items-center border-b border-gray-100 px-5 [html[data-sidebar=collapsed]_&]:justify-center [html[data-sidebar=collapsed]_&]:px-0">
          <Link
            href={homeHref}
            title={storeName ?? 'Catat Bisnisku'}
            className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            {logoUrl ? (
              <img src={logoUrl} alt={storeName ?? 'Logo'} className="w-7 h-7 rounded-lg object-contain flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-[#028697] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-medium">{(storeName ?? 'C').charAt(0).toUpperCase()}</span>
              </div>
            )}
            <span className="truncate text-sm font-medium leading-tight text-gray-900 [html[data-sidebar=collapsed]_&]:hidden">
              {storeName ?? 'Catat Bisnisku'}
            </span>
          </Link>
        </div>

        {/* Nav items */}
        <TooltipProvider delayDuration={150}>
          <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto overflow-x-hidden px-3.5 py-4 space-y-0.5 [html[data-sidebar=collapsed]_&]:px-2">
            {navItems.map((item, index) => {
              const isActive = isNavItemActive(item);
              const hasSub = !!item.subItems;
              const isExpanded = expandedHref === item.href;
              const matchedSub = isActive ? findActiveSub(item) : undefined;
              const itemLoading = pendingHref === item.href && pathname !== item.href;
              const group = groupOf(item);
              const showGroup = !!group && group !== groupOf(navItems[index - 1]);

              const iconNode = (
                <span className={cn('flex-shrink-0', isActive && 'text-[#028697]')}>
                  {itemLoading ? <Loader2 className="w-4 h-4 animate-spin text-[#028697]" /> : item.icon}
                </span>
              );

              const linkEl = (
                <Link
                  href={item.href}
                  onClick={(e) => {
                    handleNavClick(e, item.href);
                    if (hasSub) setExpandedHref(item.href);
                  }}
                  aria-label={collapsed ? item.label : undefined}
                  aria-current={isActive ? (hasSub ? 'true' : 'page') : undefined}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#028697]/40 [html[data-sidebar=collapsed]_&]:justify-center [html[data-sidebar=collapsed]_&]:px-0"
                >
                  {iconNode}
                  <span className="truncate [html[data-sidebar=collapsed]_&]:hidden">{item.label}</span>
                </Link>
              );

              return (
                <div key={item.href}>
                  {showGroup && (
                    <>
                      {index > 0 && (
                        <div aria-hidden className="mx-3 my-2 hidden border-t border-gray-100 [html[data-sidebar=collapsed]_&]:block" />
                      )}
                      <p className={cn(
                        'px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 select-none [html[data-sidebar=collapsed]_&]:hidden',
                        index === 0 ? 'pt-0' : 'pt-4'
                      )}>
                        {group}
                      </p>
                    </>
                  )}

                  <div
                    className={cn(
                      'relative flex items-center rounded-lg text-sm transition-colors duration-150',
                      isActive
                        ? 'bg-[#028697]/10 text-gray-900 font-medium'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    )}
                  >
                    {isActive && (
                      <span aria-hidden className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#028697]" />
                    )}

                    {collapsed && hasSub ? (
                      /* Rail: menu induk membuka daftar submenu di samping */
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`${item.label} (buka submenu)`}
                            title={item.label}
                            className="flex min-w-0 flex-1 items-center justify-center rounded-lg py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#028697]/40"
                          >
                            {iconNode}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start" sideOffset={10} className="w-52">
                          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            {item.label}
                          </DropdownMenuLabel>
                          {item.subItems!.map((sub) => {
                            const subActive = matchedSub?.href === sub.href;
                            const danger = isDangerSub(sub);
                            return (
                              <Fragment key={sub.href}>
                                {sub.group && (
                                  <DropdownMenuLabel className="pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                                    {sub.group}
                                  </DropdownMenuLabel>
                                )}
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={sub.href}
                                    onClick={(e) => handleNavClick(e, sub.href)}
                                    aria-current={subActive ? 'page' : undefined}
                                    className={cn(
                                      'cursor-pointer',
                                      subActive && 'bg-[#028697]/10 font-medium text-[#028697]',
                                      danger && !subActive && 'text-red-500 focus:text-red-600'
                                    )}
                                  >
                                    {sub.label}
                                  </Link>
                                </DropdownMenuItem>
                              </Fragment>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={10}>{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      linkEl
                    )}

                    {hasSub && (
                      <button
                        type="button"
                        onClick={() => setExpandedHref(isExpanded ? null : item.href)}
                        aria-expanded={isExpanded}
                        aria-controls={`submenu-${index}`}
                        aria-label={`${isExpanded ? 'Tutup' : 'Buka'} submenu ${item.label}`}
                        className="mr-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/70 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#028697]/40 [html[data-sidebar=collapsed]_&]:hidden"
                      >
                        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', isExpanded && 'rotate-180')} />
                      </button>
                    )}
                  </div>

                  {hasSub && (
                    <div
                      id={`submenu-${index}`}
                      className={cn(
                        'grid transition-[grid-template-rows,visibility] duration-200 ease-out [html[data-sidebar=collapsed]_&]:hidden',
                        isExpanded ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]'
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="mt-0.5 mb-1 ml-[1.65rem] pl-3 flex flex-col gap-0.5">
                          {item.subItems!.map((sub) => {
                            const subActive = matchedSub?.href === sub.href;
                            const subLoading = pendingHref === sub.href && pathname !== sub.href;
                            const danger = isDangerSub(sub);
                            return (
                              <div key={sub.href}>
                                {sub.group && (
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 px-3 pt-2 pb-0.5 select-none">
                                    {sub.group}
                                  </p>
                                )}
                                <Link
                                  href={sub.href}
                                  onClick={(e) => handleNavClick(e, sub.href)}
                                  aria-current={subActive ? 'page' : undefined}
                                  className={cn(
                                    'flex w-full items-center justify-between truncate border-l-2 py-1.5 pl-3 pr-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#028697]/40',
                                    subActive
                                      ? 'border-[#028697] font-medium text-[#028697]'
                                      : danger
                                        ? 'border-gray-100 text-red-400 hover:border-red-300 hover:text-red-600'
                                        : 'border-gray-100 text-gray-500 hover:border-gray-300 hover:text-gray-800'
                                  )}
                                >
                                  <span className="truncate">{sub.label}</span>
                                  {subLoading && <Loader2 className="w-3 h-3 animate-spin flex-shrink-0 ml-1.5 text-[#028697]" />}
                                </Link>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </TooltipProvider>

        {/* Info paket (akun & logout ada di menu avatar pada topbar) */}
        <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3 [html[data-sidebar=collapsed]_&]:hidden">
          <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
            <span>Paket toko</span>
            <PlanBadge plan={storePlan} storeSlug={storeSlug} compact />
          </div>
        </div>
      </aside>

      {/* ── DESKTOP TOPBAR (lg dan ke atas) ── */}
      <header className="hidden lg:flex lg:fixed lg:top-0 lg:left-[var(--sidebar-w)] lg:right-0 lg:z-30 h-16 items-center justify-between gap-4 px-8 bg-white border-b border-gray-100 transition-[left] duration-200 ease-out">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            aria-pressed={collapsed}
            title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#028697]/40"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            {activeSub && activeItem ? (
              <>
                <Link
                  href={activeItem.href}
                  onClick={(e) => handleNavClick(e, activeItem.href)}
                  className="text-gray-500 truncate transition-colors hover:text-gray-900"
                >
                  {activeItem.label}
                </Link>
                <span className="text-gray-300" aria-hidden>/</span>
                <span className="text-gray-900 font-medium truncate" aria-current="page">{activeSub.label}</span>
              </>
            ) : (
              <span className="text-gray-900 font-medium truncate" aria-current="page">{activeItem?.label ?? 'Dashboard'}</span>
            )}
          </nav>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Cari halaman"
            className="flex w-56 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-gray-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#028697]/40"
          >
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate text-left">Cari halaman…</span>
            <kbd className="flex-shrink-0 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              {isMac ? '⌘ K' : 'Ctrl K'}
            </kbd>
          </button>

          <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Menu akun"
                className="-mr-2 flex min-w-0 flex-shrink-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#028697]/40"
              >
                <div className="text-right min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate max-w-[140px]">{userName ?? 'User'}</p>
                  <p className="text-xs text-gray-400 truncate">{roleLabel}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#028697]/10 border border-[#028697]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-[#028697]">
                    {(userName ?? 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform duration-200', userMenuOpen && 'rotate-180')} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-0">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="truncate text-sm font-medium text-gray-900">{userName ?? 'User'}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center whitespace-nowrap rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500">
                    {roleLabel}
                  </span>
                  <PlanBadge plan={storePlan} storeSlug={storeSlug} compact />
                </div>
                {storeName && <p className="mt-2 truncate text-xs text-gray-400">{storeName}</p>}
              </div>
              <form action={logoutAction} className="p-1">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:bg-red-50 focus-visible:outline-none"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        entries={paletteEntries}
        currentPath={pathname}
      />

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