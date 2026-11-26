'use client';

import { useState } from 'react';
import {
  SlidersHorizontal, CheckCircle, Clock, AlertCircle, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, formatCurrency } from '@/lib/utils';
import { useActivePaymentAccounts } from '@/components/payments/payment-account-info';
import type { PaymentAccountInfo } from '@/lib/payment-accounts';
import { roundMoney } from '@/lib/payment';
import {
  MoneyField,
  PaymentEditor,
  usePaymentEditor,
  type CheckoutPayload,
} from '@/components/payments/payment-editor';

// Editor pembayaran (metode tunggal / split) dipakai bersama dengan modal penjualan baru & edit penjualan.
export type { CheckoutPayload };

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckoutDialogProps {
  open:           boolean;
  onOpenChange:   (open: boolean) => void;
  loading:        boolean;
  customerName:   string;

  subtotal:       number;
  comboDiscount:  number;
  pointDiscount:  number;
  pointsEarned:   number;
  total:          number;

  discount:       number;
  tax:            number;
  ongkir:         number;
  notes:          string;
  onDiscountChange: (n: number) => void;
  onTaxChange:      (n: number) => void;
  onOngkirChange:   (n: number) => void;
  onNotesChange:    (v: string) => void;

  paymentStatus:         'PAID' | 'PENDING';
  onPaymentStatusChange: (s: 'PAID' | 'PENDING') => void;

  onConfirm: (payload: CheckoutPayload) => void;
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

type CheckoutBodyProps = CheckoutDialogProps & {
  paymentAccounts: PaymentAccountInfo[];
  accountsLoaded:  boolean;
};

export function CheckoutDialog(props: CheckoutDialogProps) {
  // Info rekening/e-wallet/QRIS diambil tiap dialog dibuka, jadi perubahan admin langsung terlihat.
  const { accounts, loaded } = useActivePaymentAccounts(props.open);

  return (
    <Dialog open={props.open} onOpenChange={(v) => !props.loading && props.onOpenChange(v)}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[520px] p-0 gap-0 overflow-hidden border-0 shadow-2xl max-h-[92dvh] flex flex-col"
      >
        {/* Body di-mount ulang tiap dialog dibuka → pilihan metode/uang diterima selalu mulai bersih */}
        <CheckoutBody {...props} paymentAccounts={accounts} accountsLoaded={loaded} />
      </DialogContent>
    </Dialog>
  );
}

function CheckoutBody({
  onOpenChange, loading, customerName,
  subtotal, comboDiscount, pointDiscount, pointsEarned, total,
  discount, tax, ongkir, notes,
  onDiscountChange, onTaxChange, onOngkirChange, onNotesChange,
  paymentStatus, onPaymentStatusChange, onConfirm,
  paymentAccounts, accountsLoaded,
}: CheckoutBodyProps) {
  const isPending = paymentStatus === 'PENDING';

  // Opsi lanjutan: di HP tertutup bila kosong (pembayaran langsung terlihat); di layar lebar terbuka.
  const hasAdvancedValues = discount > 0 || tax > 0 || ongkir > 0 || notes.trim().length > 0;
  const [advancedOpen, setAdvancedOpen] = useState(
    () => hasAdvancedValues || (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 640px)').matches)
  );

  const grand = roundMoney(total);
  const pay = usePaymentEditor({ total, status: paymentStatus });
  const discountTooBig = discount + comboDiscount + pointDiscount > subtotal;

  const payload  = pay.payload;
  const payError = pay.error;

  const advancedVisible = advancedOpen || discountTooBig; // pesan error diskon tidak boleh tersembunyi
  const blocked   = discountTooBig || loading;
  const canSubmit = !blocked && payload !== null;

  const submit = () => { if (canSubmit && payload) onConfirm(payload); };

  // ── Ringkasan ───────────────────────────────────────────────────────────────
  const summary: Array<{ label: string; value: string; tone?: string }> = [
    { label: 'Subtotal', value: formatCurrency(subtotal) },
    ...(comboDiscount > 0 ? [{ label: 'Diskon Paket', value: `− ${formatCurrency(comboDiscount)}`, tone: 'text-green-600' }] : []),
    ...(discount > 0      ? [{ label: 'Diskon',       value: `− ${formatCurrency(discount)}`,      tone: 'text-red-500' }]   : []),
    ...(pointDiscount > 0 ? [{ label: 'Tukar Poin',   value: `− ${formatCurrency(pointDiscount)}`, tone: 'text-orange-500' }] : []),
    ...(tax > 0           ? [{ label: 'Pajak',        value: formatCurrency(tax) }]                                            : []),
    ...(ongkir > 0        ? [{ label: 'Ongkir',       value: formatCurrency(ongkir) }]                                         : []),
  ];

  return (
    <>
      {/* Header */}
      <div className="shrink-0 bg-gradient-to-br from-[#028697] to-[#015561] px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-6">
        <div className="flex items-center gap-3 pr-8">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 sm:h-10 sm:w-10">
            <SlidersHorizontal className="h-5 w-5 text-white" />
          </div>
          <DialogHeader className="min-w-0 flex-1 space-y-0.5 p-0 text-left">
            <DialogTitle className="text-base font-semibold leading-tight text-white sm:text-lg">Opsi Lanjutan &amp; Pembayaran</DialogTitle>
            <p className="truncate text-xs font-normal text-white/70">Pelanggan: {customerName}</p>
          </DialogHeader>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-2.5 sm:mt-4 sm:py-3">
          <span className="text-xs text-white/70">Total dibayar</span>
          <span className="text-xl font-bold tabular-nums text-white sm:text-2xl">{formatCurrency(grand)}</span>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-4 sm:space-y-5 sm:px-6 sm:pt-5">
        {/* ── Opsi lanjutan (bisa dilipat) ── */}
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            aria-expanded={advancedVisible}
            aria-controls="co-advanced"
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Opsi Lanjutan
              {hasAdvancedValues && <span className="rounded-full bg-[#028697]/10 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-[#028697]">Terisi</span>}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {advancedVisible ? 'Sembunyikan' : 'Diskon, pajak, ongkir, catatan'}
              <ChevronDown className={cn('h-4 w-4 transition-transform', advancedVisible && 'rotate-180')} />
            </span>
          </button>

          {advancedVisible && (
            <div id="co-advanced" className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <MoneyField id="co-discount" label="Diskon" value={discount} onChange={onDiscountChange} />
                <MoneyField id="co-tax"      label="Pajak"  value={tax}      onChange={onTaxChange} />
                <MoneyField id="co-ongkir"   label="Ongkir" value={ongkir}   onChange={onOngkirChange} />
              </div>
              {discountTooBig && (
                <p className="flex items-center gap-1.5 text-xs text-red-600" role="alert">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Total diskon melebihi subtotal belanja.
                </p>
              )}
              <div>
                <Label htmlFor="co-notes" className="text-[11px] text-muted-foreground">Catatan</Label>
                <textarea
                  id="co-notes"
                  value={notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="Catatan tambahan..."
                  rows={2}
                  maxLength={500}
                  className="mt-1 w-full resize-none rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#028697]"
                />
              </div>
            </div>
          )}
        </section>

        {/* ── Ringkasan ── */}
        {(summary.length > 1 || (pointsEarned > 0 && !isPending)) && (
        <section className="space-y-1 rounded-xl border border-border bg-muted/30 p-3 text-xs">
          {summary.map((r) => (
            <div key={r.label} className={cn('flex justify-between', r.tone ?? 'text-muted-foreground')}>
              <span>{r.label}</span><span className="tabular-nums">{r.value}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-1.5 text-sm font-bold">
            <span>Total</span>
            <span className="tabular-nums text-[#028697]">{formatCurrency(grand)}</span>
          </div>
          {pointsEarned > 0 && !isPending && (
            <p className="text-right text-[11px] text-orange-500">+{pointsEarned} poin diperoleh</p>
          )}
        </section>
        )}

        {/* ── Status bayar ── */}
        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Status Pembayaran</p>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted p-1">
            {([
              { value: 'PAID' as const,    label: 'Lunas',   icon: CheckCircle },
              { value: 'PENDING' as const, label: 'Pending', icon: Clock },
            ]).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onPaymentStatusChange(value)}
                aria-pressed={paymentStatus === value}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors',
                  paymentStatus === value ? 'bg-background text-[#028697] shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>
          {isPending && (
            <p className="text-[11px] leading-snug text-amber-700">
              Belum ada uang yang diterima. Transaksi dicatat sebagai piutang sampai statusnya diubah menjadi Lunas.
            </p>
          )}
        </section>

        {/* ── Pembayaran ── */}
        <PaymentEditor
          pay={pay}
          accounts={paymentAccounts}
          accountsLoaded={accountsLoaded}
          onEnter={submit}
          heading={
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              {isPending ? 'Metode yang Direncanakan' : 'Pembayaran'}
            </p>
          }
        />
      </div>

      {/* Footer */}
      <div className="shrink-0 space-y-2 border-t border-gray-100 bg-gray-50/60 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-4">
        {payError && !discountTooBig && (
          <p className="flex items-center gap-1.5 text-xs text-red-600" role="alert">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {payError}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-11 shrink-0 px-5"
          >
            Batal
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="h-11 min-w-0 flex-1 bg-[#028697] font-semibold text-white transition-colors hover:bg-[#017585] disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Memproses...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span className="truncate">{isPending ? 'Simpan sebagai Pending' : 'Bayar & Selesaikan'}</span>
              </span>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
