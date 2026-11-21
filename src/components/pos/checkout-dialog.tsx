'use client';

import { useId, useState } from 'react';
import {
  Banknote, Landmark, CreditCard, QrCode, SlidersHorizontal, Plus, X,
  CheckCircle, Split, Clock, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, formatCurrency } from '@/lib/utils';
import {
  PAYMENT_METHODS,
  MAX_PAYMENT_AMOUNT,
  SPLIT_METHOD,
  roundMoney,
  suggestCashAmounts,
  validatePaidPayments,
  type PaymentLineInput,
  type PaymentMethodCode,
} from '@/lib/payment';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Data pembayaran yang dikirim ke createSaleAction. */
export interface CheckoutPayload {
  /** 'SPLIT' bila lebih dari satu metode; selain itu kode metode tunggal. */
  paymentMethod: string;
  /** Kosong untuk transaksi Pending atau total Rp 0. */
  payments: PaymentLineInput[];
}

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

interface SplitRow {
  id:     number;
  method: PaymentMethodCode;
  amount: number; // nominal yang dibayar lewat metode ini
  cash:   number; // uang fisik diterima (hanya dipakai bila method = CASH)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_ICON: Record<PaymentMethodCode, typeof Banknote> = {
  CASH:     Banknote,
  TRANSFER: Landmark,
  CARD:     CreditCard,
  QRIS:     QrCode,
};

/** Ambil angka bulat dari ketikan bebas (buang titik/koma/huruf), dibatasi kolom DECIMAL(10,2). */
function toAmount(raw: string): number {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const n = digits ? parseInt(digits, 10) : 0;
  return Math.min(n, MAX_PAYMENT_AMOUNT);
}

const toDisplay = (n: number) => (n > 0 ? n.toLocaleString('id-ID') : '');

// ─── Small pieces ─────────────────────────────────────────────────────────────

function MoneyField({
  id, label, value, onChange, onEnter, disabled, className,
}: {
  id?: string;
  label?: string;
  value: number;
  onChange: (n: number) => void;
  onEnter?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const autoId = useId();
  id = id ?? autoId; // label selalu terhubung ke input (klik label memfokuskan kolom; terbaca pembaca layar)
  return (
    <div className={className}>
      {label && <Label htmlFor={id} className="text-[11px] text-muted-foreground">{label}</Label>}
      <div className={cn('relative', label && 'mt-1')}>
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={toDisplay(value)}
          onChange={(e) => onChange(toAmount(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } }}
          placeholder="0"
          disabled={disabled}
          className="h-9 pl-8 text-sm tabular-nums"
        />
      </div>
    </div>
  );
}

/** Input uang diterima + tombol cepat + kembalian. Dipakai di mode tunggal dan di baris split. */
function CashTender({
  amount, received, onChange, onEnter,
}: {
  amount: number;
  received: number;
  onChange: (n: number) => void;
  onEnter?: () => void;
}) {
  const suggestions = suggestCashAmounts(amount, 3);
  const change = roundMoney(received - amount);
  const enough = amount > 0 && received >= amount;

  return (
    <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
      <MoneyField label="Uang diterima" value={received} onChange={onChange} onEnter={onEnter} disabled={amount <= 0} />

      {amount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange(amount)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              received === amount
                ? 'border-[#028697] bg-[#028697] text-white'
                : 'border-border bg-background hover:border-[#028697]/60'
            )}
          >
            Uang Pas
          </button>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                received === s
                  ? 'border-[#028697] bg-[#028697] text-white'
                  : 'border-border bg-background hover:border-[#028697]/60'
              )}
            >
              {formatCurrency(s)}
            </button>
          ))}
        </div>
      )}

      <div
        className={cn(
          'flex items-center justify-between rounded-lg px-3 py-2',
          enough ? 'bg-emerald-600 text-white' : 'bg-background text-muted-foreground'
        )}
        aria-live="polite"
      >
        {amount <= 0 ? (
          <span className="text-xs">Isi nominal tunai terlebih dulu</span>
        ) : received <= 0 ? (
          <span className="text-xs">Masukkan nominal uang yang diterima</span>
        ) : enough ? (
          <>
            <span className="text-xs font-medium">Kembalian</span>
            <span className="text-lg font-bold tabular-nums">{formatCurrency(change)}</span>
          </>
        ) : (
          <>
            <span className="text-xs font-medium text-red-600">Uang kurang</span>
            <span className="text-sm font-bold tabular-nums text-red-600">{formatCurrency(Math.abs(change))}</span>
          </>
        )}
      </div>
    </div>
  );
}

function MethodButtons({
  value, onChange, disabledMethods = [],
}: {
  value: PaymentMethodCode;
  onChange: (m: PaymentMethodCode) => void;
  disabledMethods?: PaymentMethodCode[];
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {PAYMENT_METHODS.map((m) => {
        const Icon = METHOD_ICON[m.value];
        const active = value === m.value;
        const disabled = disabledMethods.includes(m.value);
        return (
          <button
            key={m.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m.value)}
            aria-pressed={active}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2 text-[11px] font-medium transition-all',
              active ? 'border-[#028697] bg-[#028697]/5 text-[#028697]' : 'border-gray-100 bg-gray-50/60 text-muted-foreground hover:border-gray-200',
              disabled && 'cursor-not-allowed opacity-40'
            )}
          >
            <Icon className="h-4 w-4" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

export function CheckoutDialog(props: CheckoutDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={(v) => !props.loading && props.onOpenChange(v)}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[520px] p-0 gap-0 overflow-hidden border-0 shadow-2xl max-h-[92vh] flex flex-col"
      >
        {/* Body di-mount ulang tiap dialog dibuka → pilihan metode/uang diterima selalu mulai bersih */}
        <CheckoutBody {...props} />
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
}: CheckoutDialogProps) {
  const isPending = paymentStatus === 'PENDING';

  const [mode, setMode]               = useState<'single' | 'split'>('single');
  const [method, setMethod]           = useState<PaymentMethodCode>('CASH');
  const [cashReceived, setCashReceived] = useState(0);
  const [rows, setRows]               = useState<SplitRow[]>([
    { id: 1, method: 'CASH',     amount: 0, cash: 0 },
    { id: 2, method: 'TRANSFER', amount: 0, cash: 0 },
  ]);
  const [nextRowId, setNextRowId]     = useState(3);

  const grand = roundMoney(total);
  const discountTooBig = discount + comboDiscount + pointDiscount > subtotal;
  const effectiveMode: 'single' | 'split' = isPending || grand <= 0 ? 'single' : mode;

  // ── Validasi pembayaran (fungsi yang sama dengan server) ───────────────────
  let payload: CheckoutPayload | null = null;
  let payError: string | null = null;

  if (isPending || grand <= 0) {
    payload = { paymentMethod: method, payments: [] };
  } else {
    const lines: PaymentLineInput[] =
      effectiveMode === 'single'
        ? [{ method, amount: grand, ...(method === 'CASH' ? { cashReceived } : {}) }]
        : rows
            .filter((r) => r.amount > 0)
            .map((r) => ({ method: r.method, amount: r.amount, ...(r.method === 'CASH' ? { cashReceived: r.cash } : {}) }));

    const check = validatePaidPayments(lines, grand);
    if (check.ok) {
      payload = { paymentMethod: lines.length > 1 ? SPLIT_METHOD : check.method, payments: lines };
    } else {
      payError = lines.length === 0 ? 'Isi nominal pembayaran' : check.error;
    }
  }

  const blocked   = discountTooBig || loading;
  const canSubmit = !blocked && payload !== null;

  const submit = () => { if (canSubmit && payload) onConfirm(payload); };

  // ── Split helpers ───────────────────────────────────────────────────────────
  const splitPaid      = rows.reduce((s, r) => s + r.amount, 0);
  const splitRemaining = roundMoney(grand - splitPaid);
  const usedMethods    = rows.map((r) => r.method);
  const canAddRow      = rows.length < PAYMENT_METHODS.length;

  const updateRow = (id: number, patch: Partial<SplitRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () => {
    const free = PAYMENT_METHODS.find((m) => !usedMethods.includes(m.value));
    if (!free) return;
    setRows((prev) => [...prev, { id: nextRowId, method: free.value, amount: Math.max(0, splitRemaining), cash: 0 }]);
    setNextRowId((n) => n + 1);
  };

  const removeRow = (id: number) => setRows((prev) => (prev.length > 2 ? prev.filter((r) => r.id !== id) : prev));

  const fillRemaining = (id: number) => {
    const others = rows.filter((r) => r.id !== id).reduce((s, r) => s + r.amount, 0);
    updateRow(id, { amount: Math.max(0, roundMoney(grand - others)) });
  };

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
      <div className="shrink-0 bg-gradient-to-br from-[#028697] to-[#015561] px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-3 pr-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <SlidersHorizontal className="h-5 w-5 text-white" />
          </div>
          <DialogHeader className="min-w-0 space-y-0.5 p-0 text-left">
            <DialogTitle className="truncate text-lg font-semibold leading-tight text-white">Opsi Lanjutan &amp; Pembayaran</DialogTitle>
            <p className="truncate text-xs font-normal text-white/70">Pelanggan: {customerName}</p>
          </DialogHeader>
        </div>
        <div className="mt-4 flex items-end justify-between rounded-xl bg-white/10 px-4 py-3">
          <span className="text-xs text-white/70">Total yang harus dibayar</span>
          <span className="text-2xl font-bold tabular-nums text-white">{formatCurrency(grand)}</span>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-4 pt-5 sm:px-6">
        {/* ── Opsi lanjutan ── */}
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Opsi Lanjutan</p>
          <div className="grid grid-cols-3 gap-2">
            <MoneyField id="co-discount" label="Diskon" value={discount} onChange={onDiscountChange} />
            <MoneyField id="co-tax"      label="Pajak"  value={tax}      onChange={onTaxChange} />
            <MoneyField id="co-ongkir"   label="Ongkir" value={ongkir}   onChange={onOngkirChange} />
          </div>
          {discountTooBig && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
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
        </section>

        {/* ── Ringkasan ── */}
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
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              {isPending ? 'Metode yang Direncanakan' : 'Pembayaran'}
            </p>
            {!isPending && grand > 0 && (
              <button
                type="button"
                onClick={() => setMode(effectiveMode === 'split' ? 'single' : 'split')}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  effectiveMode === 'split'
                    ? 'border-[#028697] bg-[#028697] text-white'
                    : 'border-border text-muted-foreground hover:border-[#028697]/60'
                )}
              >
                <Split className="h-3 w-3" /> Split Pembayaran
              </button>
            )}
          </div>

          {grand <= 0 && !isPending && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Total Rp 0 — tidak ada pembayaran yang perlu diterima.
            </p>
          )}

          {/* Mode tunggal */}
          {effectiveMode === 'single' && grand > 0 && (
            <div className="space-y-3">
              <MethodButtons value={method} onChange={setMethod} />
              {!isPending && method === 'CASH' && (
                <CashTender amount={grand} received={cashReceived} onChange={setCashReceived} onEnter={submit} />
              )}
            </div>
          )}

          {/* Mode split */}
          {effectiveMode === 'split' && (
            <div className="space-y-2.5">
              {rows.map((row, idx) => (
                <div key={row.id} className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground">Pembayaran {idx + 1}</span>
                    {rows.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="text-muted-foreground/60 transition-colors hover:text-destructive"
                        aria-label={`Hapus pembayaran ${idx + 1}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <MethodButtons
                    value={row.method}
                    onChange={(m) => updateRow(row.id, { method: m })}
                    disabledMethods={usedMethods.filter((m) => m !== row.method)}
                  />
                  <div className="flex items-end gap-2">
                    <MoneyField
                      className="flex-1"
                      label="Nominal"
                      value={row.amount}
                      onChange={(n) => updateRow(row.id, { amount: n })}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 text-[11px]"
                      onClick={() => fillRemaining(row.id)}
                      disabled={splitRemaining <= 0 && row.amount > 0}
                    >
                      Isi Sisa
                    </Button>
                  </div>
                  {row.method === 'CASH' && (
                    <CashTender amount={row.amount} received={row.cash} onChange={(n) => updateRow(row.id, { cash: n })} />
                  )}
                </div>
              ))}

              {canAddRow && (
                <button
                  type="button"
                  onClick={addRow}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-[#028697]/60 hover:text-[#028697]"
                >
                  <Plus className="h-3.5 w-3.5" /> Tambah metode
                </button>
              )}

              <div
                className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium',
                  splitRemaining === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                )}
                aria-live="polite"
              >
                <span>Terbayar {formatCurrency(splitPaid)} dari {formatCurrency(grand)}</span>
                <span className="tabular-nums">
                  {splitRemaining === 0 ? 'Pas ✓' : splitRemaining > 0 ? `Sisa ${formatCurrency(splitRemaining)}` : `Lebih ${formatCurrency(-splitRemaining)}`}
                </span>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="shrink-0 space-y-2 border-t border-gray-100 bg-gray-50/50 px-5 py-4 sm:px-6">
        {payError && !discountTooBig && (
          <p className="flex items-center gap-1.5 text-xs text-red-600" role="alert">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {payError}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="py-2 pr-2 text-sm text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50"
          >
            Batal
          </button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="min-w-[190px] bg-[#028697] font-semibold text-white transition-colors hover:bg-[#017585] disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Memproses...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" />
                {isPending ? 'Simpan sebagai Pending' : 'Bayar & Selesaikan'}
              </span>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
