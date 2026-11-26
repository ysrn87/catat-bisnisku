'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { Banknote, Landmark, CreditCard, QrCode, Wallet, Plus, X, Split } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, formatCurrency } from '@/lib/utils';
import { PaymentAccountPanel } from '@/components/payments/payment-account-info';
import type { PaymentAccountInfo } from '@/lib/payment-accounts';
import {
  PAYMENT_METHODS,
  MAX_PAYMENT_AMOUNT,
  SPLIT_METHOD,
  normalizePaymentMethod,
  roundMoney,
  suggestCashAmounts,
  validatePaidPayments,
  type PaymentLineInput,
  type PaymentMethodCode,
} from '@/lib/payment';

// Editor pembayaran bersama (POS kasir, penjualan baru, edit penjualan):
// satu metode atau split beberapa metode, divalidasi dengan fungsi yang sama dengan server.

// ─── Types ────────────────────────────────────────────────────────────────────

/** Data pembayaran yang dikirim ke createSaleAction / updateSaleAction. */
export interface CheckoutPayload {
  /** 'SPLIT' bila lebih dari satu metode; selain itu kode metode tunggal. */
  paymentMethod: string;
  /** Kosong untuk transaksi Pending atau total Rp 0. */
  payments: PaymentLineInput[];
}

/** Rincian awal (mis. dari transaksi yang sedang diedit). */
export interface InitialPaymentLine {
  method: string;
  amount: number;
  cashReceived?: number | null;
}

/**
 * required : kasir WAJIB mengisi uang diterima untuk tunai (POS) — kembalian dihitung.
 * optional : back-office; kosong = uang pas. Diisi hanya bila ada kembalian yang ingin dicatat.
 */
export type CashMode = 'required' | 'optional';

export interface SplitRow {
  id:     number;
  method: PaymentMethodCode;
  amount: number; // nominal yang dibayar lewat metode ini
  cash:   number; // uang fisik diterima (hanya dipakai bila method = CASH)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_ICON: Record<PaymentMethodCode, typeof Banknote> = {
  CASH:     Banknote,
  TRANSFER: Landmark,
  EWALLET:  Wallet,
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

export function MoneyField({
  id, label, value, onChange, onEnter, disabled, className, placeholder = '0',
}: {
  id?: string;
  label?: string;
  value: number;
  onChange: (n: number) => void;
  onEnter?: () => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
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
          placeholder={placeholder}
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

/** Versi ringkas untuk back-office: kosong = uang pas; isi hanya bila perlu mencatat kembalian. */
function OptionalCash({
  amount, received, onChange,
}: {
  amount: number;
  received: number;
  onChange: (n: number) => void;
}) {
  const change = roundMoney(received - amount);
  return (
    <div className="space-y-1">
      <MoneyField
        label="Uang diterima (opsional)"
        value={received}
        onChange={onChange}
        disabled={amount <= 0}
        placeholder={amount > 0 ? amount.toLocaleString('id-ID') : '0'}
      />
      <p
        className={cn(
          'text-[11px]',
          received > 0 && received < amount ? 'text-red-600' : 'text-muted-foreground'
        )}
        aria-live="polite"
      >
        {received <= 0
          ? 'Kosongkan bila uang pas.'
          : received < amount
            ? `Uang kurang ${formatCurrency(amount - received)}`
            : `Kembalian ${formatCurrency(change)}`}
      </p>
    </div>
  );
}

export function MethodButtons({
  value, onChange, disabledMethods = [],
}: {
  value: PaymentMethodCode;
  onChange: (m: PaymentMethodCode) => void;
  disabledMethods?: PaymentMethodCode[];
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
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

// ─── State (hook) ─────────────────────────────────────────────────────────────

interface PaymentEditorOptions {
  /** Total transaksi yang harus dilunasi. */
  total: number;
  status: 'PAID' | 'PENDING';
  cashMode?: CashMode;
  /** Rincian awal (satu baris = tunggal, lebih dari satu = split). */
  initialLines?: InitialPaymentLine[];
  /** Metode awal bila tidak ada rincian (mis. metode rencana transaksi Pending). */
  initialMethod?: string;
}

interface InitialState {
  mode: 'single' | 'split';
  method: PaymentMethodCode;
  cashReceived: number;
  rows: SplitRow[];
  nextRowId: number;
}

const DEFAULT_ROWS = (): SplitRow[] => [
  { id: 1, method: 'CASH',     amount: 0, cash: 0 },
  { id: 2, method: 'TRANSFER', amount: 0, cash: 0 },
];

/** Uang diterima hanya dipertahankan bila memang ada kembalian (> nominal); selain itu dianggap uang pas. */
const keptCash = (line: InitialPaymentLine) =>
  line.cashReceived != null && line.cashReceived > line.amount ? line.cashReceived : 0;

function buildInitial(o: Pick<PaymentEditorOptions, 'initialLines' | 'initialMethod' | 'cashMode'>): InitialState {
  const lines = (o.initialLines ?? []).filter((l) => normalizePaymentMethod(l.method) && l.amount > 0);
  const fallbackMethod = normalizePaymentMethod(o.initialMethod) ?? 'CASH';
  const required = (o.cashMode ?? 'required') === 'required';

  if (lines.length > 1) {
    const rows = lines.map<SplitRow>((l, i) => ({
      id: i + 1,
      method: normalizePaymentMethod(l.method) as PaymentMethodCode,
      amount: l.amount,
      cash: normalizePaymentMethod(l.method) === 'CASH' ? (required ? l.cashReceived ?? l.amount : keptCash(l)) : 0,
    }));
    return { mode: 'split', method: rows[0].method, cashReceived: 0, rows, nextRowId: rows.length + 1 };
  }
  if (lines.length === 1) {
    const method = normalizePaymentMethod(lines[0].method) as PaymentMethodCode;
    return {
      mode: 'single',
      method,
      cashReceived: method === 'CASH' ? (required ? lines[0].cashReceived ?? lines[0].amount : keptCash(lines[0])) : 0,
      rows: DEFAULT_ROWS(),
      nextRowId: 3,
    };
  }
  return { mode: 'single', method: fallbackMethod, cashReceived: 0, rows: DEFAULT_ROWS(), nextRowId: 3 };
}

export function usePaymentEditor(options: PaymentEditorOptions) {
  const { total, status } = options;
  const cashMode = options.cashMode ?? 'required';

  // Opsi awal dibaca sekali (saat mount) dan dipakai lagi oleh reset().
  const initialOptions = useRef(options);
  const [init] = useState(() => buildInitial(options));

  const [mode, setMode]                 = useState<'single' | 'split'>(init.mode);
  const [method, setMethod]             = useState<PaymentMethodCode>(init.method);
  const [cashReceived, setCashReceived] = useState(init.cashReceived);
  const [rows, setRows]                 = useState<SplitRow[]>(init.rows);
  const [nextRowId, setNextRowId]       = useState(init.nextRowId);

  const isPending = status === 'PENDING';
  const grand = roundMoney(total);
  const effectiveMode: 'single' | 'split' = isPending || grand <= 0 ? 'single' : mode;

  // Validasi pembayaran (fungsi yang sama dengan server)
  const cashField = (n: number) => (cashMode === 'required' ? { cashReceived: n } : n > 0 ? { cashReceived: n } : {});

  let payload: CheckoutPayload | null = null;
  let error: string | null = null;

  if (isPending || grand <= 0) {
    payload = { paymentMethod: method, payments: [] };
  } else {
    const lines: PaymentLineInput[] =
      effectiveMode === 'single'
        ? [{ method, amount: grand, ...(method === 'CASH' ? cashField(cashReceived) : {}) }]
        : rows
            .filter((r) => r.amount > 0)
            .map((r) => ({ method: r.method, amount: r.amount, ...(r.method === 'CASH' ? cashField(r.cash) : {}) }));

    const check = validatePaidPayments(lines, grand);
    if (check.ok) {
      payload = { paymentMethod: lines.length > 1 ? SPLIT_METHOD : check.method, payments: lines };
    } else {
      error = lines.length === 0 ? 'Isi nominal pembayaran' : check.error;
    }
  }

  // Split helpers
  const splitPaid      = roundMoney(rows.reduce((s, r) => s + r.amount, 0));
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

  const reset = () => {
    const fresh = buildInitial(initialOptions.current);
    setMode(fresh.mode);
    setMethod(fresh.method);
    setCashReceived(fresh.cashReceived);
    setRows(fresh.rows);
    setNextRowId(fresh.nextRowId);
  };

  return {
    cashMode, isPending, grand, mode, setMode, effectiveMode,
    method, setMethod, cashReceived, setCashReceived,
    rows, updateRow, addRow, removeRow, fillRemaining, canAddRow, usedMethods,
    splitPaid, splitRemaining,
    payload, error, reset,
  };
}

export type PaymentEditorState = ReturnType<typeof usePaymentEditor>;

// ─── Komponen ─────────────────────────────────────────────────────────────────

interface PaymentEditorProps {
  pay: PaymentEditorState;
  accounts: PaymentAccountInfo[];
  accountsLoaded: boolean;
  /** Judul di kiri baris tombol "Split Pembayaran" (kosong = hanya tombol di kanan). */
  heading?: ReactNode;
  /** Dipanggil saat Enter di kolom uang diterima (mode tunggal). */
  onEnter?: () => void;
  disabled?: boolean;
  className?: string;
}

export function PaymentEditor({ pay, accounts, accountsLoaded, heading, onEnter, disabled, className }: PaymentEditorProps) {
  const {
    cashMode, isPending, grand, effectiveMode, setMode,
    method, setMethod, cashReceived, setCashReceived,
    rows, updateRow, addRow, removeRow, fillRemaining, canAddRow, usedMethods,
    splitPaid, splitRemaining,
  } = pay;

  const showToggle = !isPending && grand > 0;

  return (
    <fieldset disabled={disabled} className={cn('m-0 min-w-0 space-y-3 border-0 p-0', className)}>
      {(heading || showToggle) && (
        <div className={cn('flex items-center', heading ? 'justify-between' : 'justify-end')}>
          {heading}
          {showToggle && (
            <button
              type="button"
              onClick={() => setMode(effectiveMode === 'split' ? 'single' : 'split')}
              aria-pressed={effectiveMode === 'split'}
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
      )}

      {grand <= 0 && !isPending && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Total Rp 0 — tidak ada pembayaran yang perlu diterima.
        </p>
      )}

      {/* Mode tunggal */}
      {effectiveMode === 'single' && grand > 0 && (
        <div className="space-y-3">
          <MethodButtons value={method} onChange={setMethod} />
          <PaymentAccountPanel method={method} accounts={accounts} loaded={accountsLoaded} />
          {!isPending && method === 'CASH' && (
            cashMode === 'required'
              ? <CashTender amount={grand} received={cashReceived} onChange={setCashReceived} onEnter={onEnter} />
              : <OptionalCash amount={grand} received={cashReceived} onChange={setCashReceived} />
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
              <PaymentAccountPanel method={row.method} accounts={accounts} loaded={accountsLoaded} />
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
                cashMode === 'required'
                  ? <CashTender amount={row.amount} received={row.cash} onChange={(n) => updateRow(row.id, { cash: n })} />
                  : <OptionalCash amount={row.amount} received={row.cash} onChange={(n) => updateRow(row.id, { cash: n })} />
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
    </fieldset>
  );
}
