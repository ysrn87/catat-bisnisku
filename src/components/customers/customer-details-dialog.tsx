'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { ShoppingCart, Package, TrendingUp, Star, Sparkles, Phone, MapPin, Mail, User, UserCog, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MemberCard } from '../member/member-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCustomerPurchaseHistory } from '@/actions/customers';
import { EditMemberDialog } from './edit-member-dialog';
import { CustomerDeleteButton } from './customer-delete-button';
import { NonMemberDialog } from './non-member-dialog';
import { UpgradeToMemberDialog } from './upgrade-to-member-dialog';
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog';
import { deleteWalkInCustomerAction as deleteNonMemberCustomerAction } from '@/actions/customers';
import { DialogTitle } from '@radix-ui/react-dialog';

interface MemberCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  birthday?: Date | null;
  photoUrl?: string | null;
  points: number;
  createdAt: Date;
  sales: Array<{ id: string; total: any }>;
  _count: { sales: number };
  type: 'member';
}

interface NonMemberCustomer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  createdAt: Date;
  sales: Array<{ id: string; total: any }>;
  _count: { sales: number };
  type: 'non-member';
}

type Customer = MemberCustomer | NonMemberCustomer;

interface CustomerDetailsDialogProps {
  customer: Customer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showActions?: boolean;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatFullDate(date: Date | string) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

// ── stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 ${color}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
          {icon}
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-none mb-1 break-all">
        {value}
      </p>
      <p className="text-[10px] font-semibold text-white/70 uppercase tracking-wider">{label}</p>
      {sub && <p className="text-[10px] text-white/60 mt-0.5">{sub}</p>}
      <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
    </div>
  );
}

// ── purchase history item ─────────────────────────────────────────────────────

function HistoryItem({ sale, isMember }: { sale: any; isMember: boolean }) {
  const [open, setOpen] = useState(false);
  const statusColor =
    sale.paymentStatus === 'PAID'    ? 'bg-emerald-100 text-emerald-700' :
    sale.paymentStatus === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                       'bg-red-100 text-red-700';
  const statusLabel =
    sale.paymentStatus === 'PAID'    ? 'Lunas' :
    sale.paymentStatus === 'PENDING' ? 'Pending' : 'Belum Lunas';

  return (
    <div className="group">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full text-left flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-xl hover:bg-gray-50 hover:text-black transition-colors"
      >
        {/* date column */}
        <div className="shrink-0 w-9 text-center">
          <p className="text-base font-bold text-gray-800 leading-none">
            {new Date(sale.createdAt).getDate()}
          </p>
          <p className="text-[9px] uppercase text-gray-400 font-semibold tracking-wide">
            {new Date(sale.createdAt).toLocaleDateString('id-ID', { month: 'short' })}
          </p>
        </div>

        <div className="shrink-0 w-px h-9 bg-gray-200" />

        {/* main info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <p className="text-[10px] font-semibold text-gray-900 truncate max-w-[120px] sm:max-w-none">
              {sale.saleNumber}
            </p>
            <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 truncate">
            {sale.items.length} item · {sale.paymentMethod}
            {isMember && sale.pointsEarned > 0 && (
              <span className="text-blue-500 ml-1">+{sale.pointsEarned} pts</span>
            )}
          </p>
        </div>

        {/* amount */}
        <div className="shrink-0 text-right ml-1">
          <p className="text-xs font-bold text-gray-900">{formatCurrency(sale.total)}</p>
          <p className="text-[10px] text-gray-400 group-hover:text-gray-600 transition-colors">
            {open ? 'Tutup ▲' : 'Detail ▾'}
          </p>
        </div>
      </button>

      {open && (
        <div className="mx-3 sm:mx-4 mb-3 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {sale.items.map((item: any) => (
              <div key={item.id} className="flex justify-between items-start gap-3 px-3 sm:px-4 py-2.5">
                <div className="min-w-0 text-xs">
                  <span className="text-gray-800">{item.variant.name}</span>
                  <span className="text-gray-400 mx-1">·</span>
                  <span className="text-amber-600 ml-1 text-[10px]">×{item.quantity}</span>
                  <p className="text-gray-500">{item.variant.product.name}</p>
                </div>
                <span className="font-semibold text-gray-700 shrink-0 text-xs">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          {(sale.discount > 0 || (isMember && sale.pointsRedeemed > 0)) && (
            <div className="border-t border-gray-200 px-3 sm:px-4 py-2.5 space-y-1">
              {sale.discount > 0 && (
                <div className="flex justify-between text-xs text-emerald-600">
                  <span>Diskon</span>
                  <span>− {formatCurrency(sale.discount)}</span>
                </div>
              )}
              {isMember && sale.pointsRedeemed > 0 && (
                <div className="flex justify-between text-xs text-violet-600">
                  <span>Poin ditukar ({sale.pointsRedeemed} pts)</span>
                  <span>− {formatCurrency(sale.pointsRedeemed)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function CustomerDetailsDialog({
  customer, open, onOpenChange, showActions = false,
}: CustomerDetailsDialogProps) {
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const totalSpent  = customer.sales.reduce((s, sale) => s + Number(sale.total), 0);
  const avgPurchase = customer._count.sales > 0 ? totalSpent / customer._count.sales : 0;
  const isMember    = customer.type === 'member';
  const initials    = getInitials(customer.name);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getCustomerPurchaseHistory(customer.id)
        .then(setPurchaseHistory)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, customer.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="
          w-[calc(100vw-24px)] sm:w-auto
          sm:max-w-[680px]
          max-h-[92vh]
          overflow-hidden flex flex-col
          p-0 gap-0
          rounded-2xl
        "
      >
        <DialogTitle className="sr-only">Detail Pelanggan</DialogTitle>

        {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 sm:px-6 pt-5 pb-4 overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-24 translate-x-24 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 translate-y-16 -translate-x-16 pointer-events-none" />

          {/* Top row: avatar + info — pr-10 keeps clear of the Radix close button */}
          <div className="relative flex items-start gap-3 pr-10">
            {/* avatar */}
            <div className="shrink-0">
              {isMember && (customer as MemberCustomer).photoUrl ? (
                <img
                  src={(customer as MemberCustomer).photoUrl!}
                  alt={customer.name}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-white/20 shadow-xl"
                />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl border-2 border-white/20">
                  <span className="text-lg sm:text-xl font-bold text-white">{initials}</span>
                </div>
              )}
            </div>

            {/* name + meta */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <h2 className="text-base sm:text-xl font-bold text-white leading-snug break-words">
                  {customer.name}
                </h2>
                <span className={`shrink-0 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  isMember
                    ? 'bg-violet-500/30 text-violet-300 border border-violet-400/30'
                    : 'bg-slate-600/60 text-slate-300 border border-slate-500/30'
                }`}>
                  {isMember ? '✦ Member' : 'Customer'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-400 text-[11px]">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span className="truncate max-w-[110px] sm:max-w-none">{customer.phone}</span>
                </span>
                {isMember && (customer as MemberCustomer).email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[120px] sm:max-w-none">{(customer as MemberCustomer).email}</span>
                  </span>
                )}
              </div>

              {isMember && (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-400/15 border border-amber-400/25 rounded-full px-2.5 py-0.5">
                  <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-amber-300 text-xs font-bold">
                    {(customer as MemberCustomer).points.toLocaleString('id-ID')} Poin
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons — own row, below the name block, never near the close button */}
          {showActions && (
            <div className="relative mt-3 flex items-center gap-2">
              {isMember ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Edit Member"
                    className="group"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="w-4 h-4 text-white group-hover:text-slate-900 transition-colors" />
                  </Button>
                  <EditMemberDialog
                    customer={{
                      id:       customer.id,
                      name:     customer.name,
                      phone:    customer.phone,
                      email:    (customer as MemberCustomer).email ?? null,
                      birthday: (customer as MemberCustomer).birthday ?? null,
                      photoUrl: (customer as MemberCustomer).photoUrl ?? null,
                      points:   (customer as MemberCustomer).points,
                    }}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                  />
                  <CustomerDeleteButton customerId={customer.id} />
                </>
              ) : (
                <>
                  <NonMemberDialog
                    mode="edit"
                    customer={{
                      id: customer.id, name: customer.name,
                      phone: customer.phone, address: customer.address as string,
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Upgrade ke Member"
                    className="group"
                    onClick={() => setUpgradeOpen(true)}
                  >
                    <UserCog className="w-4 h-4 text-white group-hover:text-slate-900 transition-colors" />
                  </Button>
                  <UpgradeToMemberDialog
                    customer={{ id: customer.id, name: customer.name, phone: customer.phone }}
                    open={upgradeOpen}
                    onOpenChange={setUpgradeOpen}
                  />
                  <DeleteConfirmDialog
                    title="Hapus Non-Member"
                    description="Yakin ingin menghapus pelanggan ini? Pelanggan tidak dapat dihapus jika memiliki riwayat transaksi."
                    onConfirm={() => deleteNonMemberCustomerAction(customer.id)}
                  />
                </>
              )}
            </div>
          )}

          {/* Quick stats — responsive text prevents overflow */}
          <div className="relative mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
            {[
              {
                label: 'Transaksi',
                value: customer._count.sales.toString(),
                icon: <ShoppingCart className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-300" />,
              },
              {
                label: 'Total Belanja',
                value: formatCurrency(totalSpent),
                icon: <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-300" />,
              },
              {
                label: 'Rata-rata',
                value: formatCurrency(avgPurchase),
                icon: <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-300" />,
              },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.08] backdrop-blur-sm border border-white/10 rounded-xl px-2 sm:px-3 py-2 sm:py-2.5">
                <div className="flex items-center gap-1 mb-1">
                  {s.icon}
                  <span className="text-[8px] sm:text-[10px] text-slate-300 uppercase tracking-wider leading-none">
                    {s.label}
                  </span>
                </div>
                <p className="text-[11px] sm:text-sm font-medium text-white break-all leading-snug">
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── TABS ────────────────────────────────────────────────────────── */}
        <Tabs defaultValue="profile" className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="px-4 sm:px-6 pt-3 shrink-0">
            <TabsList className="w-full grid grid-cols-3 bg-gray-100/80 rounded-xl p-1 h-auto">
              <TabsTrigger value="profile"    className="rounded-lg text-xs font-semibold py-1.5 sm:py-2">Profil</TabsTrigger>
              <TabsTrigger value="statistics" className="rounded-lg text-xs font-semibold py-1.5 sm:py-2">Statistik</TabsTrigger>
              <TabsTrigger value="history"    className="rounded-lg text-xs font-semibold py-1.5 sm:py-2">Riwayat</TabsTrigger>
            </TabsList>
          </div>

          {/* ── PROFILE ── */}
          <TabsContent value="profile" className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 mt-3 min-h-0">
            {isMember ? (
              <MemberCard
                user={{
                  id: customer.id,
                  name: customer.name,
                  email: (customer as MemberCustomer).email,
                  phone: customer.phone,
                  address: (customer as MemberCustomer).address,
                  birthday: (customer as MemberCustomer).birthday,
                  photoUrl: (customer as MemberCustomer).photoUrl,
                  points: (customer as MemberCustomer).points,
                  createdAt: customer.createdAt,
                }}
                showMembershipId
              />
            ) : (
              <div className="space-y-2.5">
                {[
                  { icon: <Phone className="w-4 h-4 text-emerald-600" />, bg: 'bg-emerald-50', label: 'Telepon',          value: customer.phone },
                  { icon: <MapPin className="w-4 h-4 text-rose-500"   />, bg: 'bg-rose-50',    label: 'Alamat',           value: customer.address ?? undefined },
                  { icon: <User   className="w-4 h-4 text-amber-600"  />, bg: 'bg-amber-50',   label: 'Pelanggan Sejak',  value: formatFullDate(customer.createdAt) },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-gray-50 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                    <div className={`p-2 rounded-lg ${row.bg} shrink-0`}>{row.icon}</div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 font-medium mb-0.5">{row.label}</p>
                      <p className="text-xs text-gray-800 break-words">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── STATISTICS ── */}
          <TabsContent value="statistics" className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 mt-3 min-h-0">
            <div className="grid grid-cols-2 gap-2.5 mb-2.5">
              <StatCard
                icon={<ShoppingCart className="w-4 h-4 text-white" />}
                label="Total Transaksi"
                value={customer._count.sales.toString()}
                color="bg-gradient-to-br from-violet-500 to-indigo-600"
              />
              <StatCard
                icon={<TrendingUp className="w-4 h-4 text-white" />}
                label="Total Belanja"
                value={formatCurrency(totalSpent)}
                color="bg-gradient-to-br from-emerald-500 to-teal-600"
              />
            </div>
            <StatCard
              icon={<Star className="w-4 h-4 text-white" />}
              label="Rata-rata per Transaksi"
              value={formatCurrency(avgPurchase)}
              sub={customer._count.sales > 0 ? `Dari ${customer._count.sales} transaksi` : undefined}
              color="bg-gradient-to-br from-orange-500 to-rose-500"
            />

            {isMember && (
              <div className="mt-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 rounded-xl bg-amber-400/20 shrink-0">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider mb-0.5">Saldo Poin</p>
                  <p className="text-xl sm:text-2xl font-bold text-amber-700 leading-none">
                    {(customer as MemberCustomer).points.toLocaleString('id-ID')}
                    <span className="text-sm font-normal text-amber-500 ml-1">pts</span>
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── HISTORY ── */}
          <TabsContent value="history" className="flex-1 overflow-y-auto pb-6 mt-3 min-h-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
                <p className="text-sm">Memuat riwayat...</p>
              </div>
            ) : purchaseHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                <div className="p-4 rounded-2xl bg-gray-100">
                  <Package className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium">Belum ada riwayat transaksi</p>
              </div>
            ) : (
              <div className="px-1 sm:px-2">
                {purchaseHistory.map((sale, i) => (
                  <div key={sale.id}>
                    <HistoryItem sale={sale} isMember={isMember} />
                    {i < purchaseHistory.length - 1 && (
                      <div className="mx-3 sm:mx-4 h-px bg-gray-100" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}