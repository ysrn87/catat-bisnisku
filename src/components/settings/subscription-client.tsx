'use client';

import { Crown, Zap, CheckCircle2, Clock, AlertTriangle, Package, Users, Receipt, ChevronDown, ChevronUp } from 'lucide-react';
import { UpgradeButton } from '@/components/plan/upgrade-button';
import { useState } from 'react';

interface PaymentRecord {
  id: string;
  amount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
  planDays: number;
  midtransOrderId: string;
}

interface Props {
  storeSlug: string;
  plan: 'FREE' | 'PRO';
  planExpiresAt: string | null;
  usage: {
    productCount: number;
    managerCount: number;
    cashierCount: number;
    todayTxCount: number;
  };
  planLimits: {
    FREE: { products: number; managers: number; cashiers: number; dailyTransactions: number };
    PRO:  { products: number; managers: number; cashiers: number; dailyTransactions: number };
  };
  paymentHistory: PaymentRecord[];
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function UsageBar({
  label,
  icon: Icon,
  current,
  limit,
  isPro,
}: {
  label: string;
  icon: React.ElementType;
  current: number;
  limit: number;
  isPro: boolean;
}) {
  if (isPro) {
    return (
      <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
        <div className="flex items-center gap-2.5 text-sm text-gray-700">
          <Icon className="w-4 h-4 text-[#028697]" />
          {label}
        </div>
        <span className="text-sm font-semibold text-[#028697] flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Unlimited
        </span>
      </div>
    );
  }

  const pct     = Math.min((current / limit) * 100, 100);
  const isFull  = pct >= 100;
  const isNear  = pct >= 80;
  const barColor = isFull ? 'bg-red-500' : isNear ? 'bg-amber-400' : 'bg-[#028697]';
  const textColor = isFull ? 'text-red-600' : isNear ? 'text-amber-600' : 'text-gray-500';

  return (
    <div className="py-3 border-b border-gray-100 last:border-0 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-sm text-gray-700">
          <Icon className="w-4 h-4 text-gray-400" />
          {label}
        </div>
        <span className={`text-sm font-semibold ${textColor} flex items-center gap-1`}>
          {current} / {limit}
          {isFull && <AlertTriangle className="w-3.5 h-3.5" />}
        </span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function SubscriptionClient({ storeSlug, plan, planExpiresAt, usage, planLimits, paymentHistory }: Props) {
  const [showHistory, setShowHistory] = useState(false);

  const now         = new Date();
  const expiresAt   = planExpiresAt ? new Date(planExpiresAt) : null;
  const daysLeft    = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const isExpiringSoon = plan === 'PRO' && daysLeft <= 7;
  const limits      = planLimits[plan];
  const proLimits   = planLimits.PRO;

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── Status Card ── */}
      <div className={`rounded-2xl border-2 p-5 ${
        plan === 'PRO'
          ? isExpiringSoon
            ? 'border-amber-300 bg-amber-50'
            : 'border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50'
          : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {plan === 'PRO' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-700 border border-amber-300">
                  <Crown className="w-3.5 h-3.5" /> PRO
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-500 border border-gray-200">
                  <Zap className="w-3.5 h-3.5" /> FREE
                </span>
              )}
            </div>

            {plan === 'PRO' && expiresAt ? (
              <div className="space-y-0.5 pt-1">
                <p className="text-sm text-gray-600">
                  Aktif hingga <span className="font-semibold text-gray-900">{formatDate(planExpiresAt!)}</span>
                </p>
                <p className={`text-sm font-semibold flex items-center gap-1.5 ${isExpiringSoon ? 'text-amber-600' : 'text-[#028697]'}`}>
                  <Clock className="w-3.5 h-3.5" />
                  {daysLeft === 0 ? 'Kedaluwarsa hari ini' : `${daysLeft} hari lagi`}
                </p>
              </div>
            ) : plan === 'FREE' ? (
              <p className="text-sm text-gray-500 pt-1">Akses fitur dasar tanpa batas waktu</p>
            ) : null}
          </div>

          {/* Progress ring for PRO */}
          {plan === 'PRO' && expiresAt && (
            <div className="relative flex-shrink-0 w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="22" fill="none" stroke="#f3f4f6" strokeWidth="5" />
                <circle
                  cx="28" cy="28" r="22" fill="none"
                  stroke={isExpiringSoon ? '#f59e0b' : '#028697'}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - Math.min(daysLeft, 30) / 30)}`}
                  className="transition-all duration-700"
                />
              </svg>
              <span className={`absolute inset-0 flex flex-col items-center justify-center text-center ${isExpiringSoon ? 'text-amber-600' : 'text-[#028697]'}`}>
                <span className="text-base font-bold leading-none">{daysLeft}</span>
                <span className="text-[9px] font-medium leading-none mt-0.5">hari</span>
              </span>
            </div>
          )}
        </div>

        {/* Expiring soon warning */}
        {isExpiringSoon && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-amber-100 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Langganan PRO kamu akan segera berakhir. Perpanjang sekarang agar tidak kehilangan akses fitur PRO.
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-4">
          {plan === 'FREE' && (
            <UpgradeButton storeSlug={storeSlug} />
          )}
          {plan === 'PRO' && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              <span>Perpanjang otomatis menambah hari dari sisa aktif yang ada</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Usage Card ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Penggunaan Saat Ini</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {plan === 'PRO' ? 'Semua fitur PRO aktif' : `Plan FREE — upgrade untuk batas lebih tinggi`}
          </p>
        </div>
        <div className="px-5">
          <UsageBar label="Produk"              icon={Package} current={usage.productCount}  limit={limits.products}           isPro={plan === 'PRO'} />
          <UsageBar label="Manager"             icon={Users}   current={usage.managerCount}   limit={limits.managers}           isPro={plan === 'PRO'} />
          <UsageBar label="Kasir"               icon={Users}   current={usage.cashierCount}   limit={limits.cashiers}           isPro={plan === 'PRO'} />
          <UsageBar label="Transaksi Hari Ini"  icon={Receipt} current={usage.todayTxCount}   limit={limits.dailyTransactions}  isPro={plan === 'PRO'} />
        </div>

        {plan === 'FREE' && (
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 font-medium mb-2.5">Dengan PRO kamu dapat:</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                `${proLimits.products} produk`,
                `${proLimits.managers} manager`,
                'Export Excel',
                'Custom branding',
                'Transaksi unlimited',
                `${proLimits.cashiers} kasir`,
              ].map((f) => (
                <div key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <CheckCircle2 className="w-3 h-3 text-[#028697] flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Payment History ── */}
      {paymentHistory.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div>
              <h2 className="text-sm font-semibold text-gray-900 text-left">Riwayat Pembayaran</h2>
              <p className="text-xs text-gray-500 mt-0.5">{paymentHistory.length} transaksi tercatat</p>
            </div>
            {showHistory
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />
            }
          </button>

          {showHistory && (
            <div className="border-t border-gray-100">
              {paymentHistory.map((p) => {
                const isPaid   = p.status === 'PAID';
                const isFailed = p.status === 'FAILED';
                return (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                          isPaid   ? 'bg-green-100 text-green-700' :
                          isFailed ? 'bg-red-100 text-red-600'    : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {isPaid ? 'Lunas' : isFailed ? 'Gagal' : 'Pending'}
                        </span>
                        <span className="text-xs text-gray-500">{p.planDays} hari PRO</span>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate">{p.midtransOrderId}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-sm font-semibold text-gray-900">{formatRupiah(p.amount)}</p>
                      <p className="text-[11px] text-gray-400">
                        {formatDate(p.paidAt ?? p.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
