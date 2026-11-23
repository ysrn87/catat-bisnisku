'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PaymentStatus } from '@prisma/client';
import { ShoppingCart, Search, User, X, Plus, Minus, Trash2, CheckCircle, Receipt, Printer, Layers, ScanBarcode, Pause, Play, Share2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PosNotice, type PosNoticeData } from './pos-notice';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createSaleAction } from '@/actions/sales';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { ComboPickerDialog, type ComboCartLine } from './combo-picker-dialog';
import { CheckoutDialog, type CheckoutPayload } from './checkout-dialog';
import { ScannerDialog } from './scanner-dialog';
import { posFeedback, readStorage, writeStorage } from './pos-feedback';
import { useKeyboardBarcode } from '@/hooks/use-keyboard-barcode';
import { paymentMethodLabel, roundMoney } from '@/lib/payment';
import type { ComboInfo } from '@/lib/combo-pricing';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductVariant {
  id: string;
  name: string;
  price: number;
  stock: number;
  pointsPerUnit: number;
  barcode: string | null;
  type: string;
  product: {
    name: string;
  };
  category?: {
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

interface Member {
  id: string;
  name: string;
  points: number;
}

interface WalkInCustomer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
}

interface CartItem {
  variantId: string;
  variantName: string;
  productName: string;
  price: number;
  quantity: number;
  stock: number;
  isPreorder: boolean;
  emoji: string;
}

/** Keranjang yang ditahan (disimpan di perangkat kasir, per toko). */
interface HeldCart {
  id: string;
  heldAt: number;
  label: string;
  total: number;
  count: number;
  cart: CartItem[];
  comboCart: ComboCartLine[];
  customerType: 'customer' | 'member' | 'walk-in';
  customerId: string;
  walkInCustomerId: string;
  discount: number;
  tax: number;
  ongkir: number;
  notes: string;
  pointsToRedeem: number;
}

const MAX_HELD = 10;

interface ReceiptCombo {
  name: string;
  packagePrice: number;
  itemsTotal: number;
  discount: number;
  lines: Array<{ productName: string; variantName: string; price: number; quantity: number }>;
}

interface ReceiptPayment {
  method: string;
  amount: number;
  cashReceived: number | null;
  changeAmount: number | null;
}

// Hasil createSaleAction yang sukses (nilai paket & pembayaran dihitung/divalidasi server)
interface CreateSaleOk {
  success: true;
  saleId: string;
  saleNumber: string;
  createdAt: Date;
  subtotal: number;
  comboDiscount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  cashReceived: number | null;
  changeAmount: number | null;
  payments: ReceiptPayment[];
  combos: ReceiptCombo[];
}

interface ReceiptData {
  saleId: string;
  saleNumber: string;
  createdAt: Date;
  items: CartItem[];
  customerName: string;
  paymentMethod: string;
  payments: ReceiptPayment[];
  cashReceived: number | null;
  changeAmount: number | null;
  subtotal: number;
  discount: number;
  tax: number;
  ongkir: number;
  pointDiscount: number;
  total: number;
  pointsEarned: number;
  paymentStatus: string;
  combos: ReceiptCombo[];
  comboDiscount: number;
}

interface PosPanelProps {
  variants: ProductVariant[];
  members: Member[];
  walkInCustomers: WalkInCustomer[];
  conversionRate: number;
  storeSlug: string;
  storeName: string;
  cashierName?: string;
  combos?: ComboInfo[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_EMOJI = '📦';

function getVariantEmoji(variant: ProductVariant): string {
  return variant.category?.icon || DEFAULT_EMOJI;
}

// ─── Receipt Dialog ────────────────────────────────────────────────────────────

function buildReceiptText(data: ReceiptData, storeName: string): string {
  const lines: string[] = [`*${storeName}*`, data.saleNumber, formatDateTime(data.createdAt), ''];
  for (const i of data.items) {
    const name = i.variantName !== i.productName ? `${i.productName} – ${i.variantName}` : i.productName;
    lines.push(`• ${name} ×${i.quantity}  ${formatCurrency(i.price * i.quantity)}`);
  }
  for (const c of data.combos) lines.push(`• Paket ${c.name}  ${formatCurrency(c.packagePrice)}`);
  lines.push('', `*Total: ${formatCurrency(data.total)}*`);
  if (data.payments.length > 1) {
    for (const p of data.payments) lines.push(`${paymentMethodLabel(p.method)}: ${formatCurrency(p.amount)}`);
  } else {
    lines.push(`Bayar: ${data.paymentMethod}${data.paymentStatus === 'PENDING' ? ' (Pending)' : ''}`);
  }
  if (data.cashReceived !== null && data.changeAmount !== null) {
    lines.push(`Tunai diterima: ${formatCurrency(data.cashReceived)}`, `Kembalian: ${formatCurrency(data.changeAmount)}`);
  }
  lines.push('', 'Terima kasih 🙏');
  return lines.join('\n');
}

function ReceiptDialog({
  data,
  storeName,
  cashierName,
  onClose,
  onPrint,
  onShare,
}: {
  data: ReceiptData;
  storeName: string;
  cashierName?: string;
  onClose: () => void;
  onPrint: () => void;
  onShare: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92dvh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900">
        {/* Header */}
        <div className="shrink-0 bg-[#028697] px-5 py-4 text-white text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircle className="w-6 h-6" />
            <span className="text-lg font-bold">Transaksi Berhasil!</span>
          </div>
          <p className="text-sm text-white/80">
            {data.paymentStatus === 'PENDING' ? 'Disimpan sebagai pending' : 'Pembayaran diterima'}
          </p>
        </div>

        {/* Receipt body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Sale info */}
          <div className="text-center">
            <p className="text-sm font-semibold">{storeName}</p>
            <p className="text-xs text-muted-foreground">
              {data.saleNumber} · {formatDateTime(data.createdAt)}
            </p>
            {cashierName && (
              <p className="text-xs text-muted-foreground">Kasir: {cashierName}</p>
            )}
          </div>

          {/* Customer & payment */}
          <div className="flex justify-between text-sm border-t border-dashed border-border pt-3">
            <span className="text-muted-foreground">Pelanggan</span>
            <span className="font-medium">{data.customerName}</span>
          </div>
          {data.payments.length > 1 ? (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Pembayaran (Split)</span>
              {data.payments.map((p) => (
                <div key={p.method} className="flex justify-between pl-3 text-sm">
                  <span className="text-muted-foreground">{paymentMethodLabel(p.method)}</span>
                  <span className="font-medium">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pembayaran</span>
              <span className="font-medium">{data.paymentMethod}</span>
            </div>
          )}
          {data.paymentStatus === 'PENDING' && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="text-yellow-600 font-medium">Pending</span>
            </div>
          )}

          {/* Items */}
          <div className="border-t border-dashed border-border pt-3 space-y-1.5">
            {data.items.map((item) => (
              <div key={item.variantId} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 break-words text-muted-foreground">
                  {item.emoji} {item.productName}
                  {item.variantName !== item.productName ? ` – ${item.variantName}` : ''}
                  <span className="text-xs ml-1 whitespace-nowrap">×{item.quantity}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap tabular-nums">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}

            {data.combos.map((c, ci) => (
              <div key={ci} className="space-y-1 pt-1.5 first:pt-0">
                <p className="text-sm font-semibold">{c.name}</p>
                {c.lines.map((l, li) => (
                  <div key={li} className="flex justify-between gap-2 pl-3 text-sm">
                    <span className="min-w-0 break-words text-muted-foreground">
                      {l.productName}{l.variantName !== l.productName ? ` – ${l.variantName}` : ''}
                    </span>
                    <span className="shrink-0">{l.quantity} × {formatCurrency(l.price)}</span>
                  </div>
                ))}
                {c.discount > 0 && (
                  <div className="flex justify-between pl-3 text-sm text-green-600">
                    <span>Diskon paket</span>
                    <span>− {formatCurrency(c.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between pl-3 text-sm font-medium">
                  <span>Harga paket</span>
                  <span>{formatCurrency(c.itemsTotal - c.discount)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="border-t border-dashed border-border pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(data.subtotal)}</span>
            </div>
            {data.comboDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Diskon Paket</span>
                <span>− {formatCurrency(data.comboDiscount)}</span>
              </div>
            )}
            {data.discount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Diskon</span>
                <span>− {formatCurrency(data.discount)}</span>
              </div>
            )}
            {data.pointDiscount > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>Tukar Poin</span>
                <span>− {formatCurrency(data.pointDiscount)}</span>
              </div>
            )}
            {data.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pajak</span>
                <span>{formatCurrency(data.tax)}</span>
              </div>
            )}
            {data.ongkir > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ongkir</span>
                <span>{formatCurrency(data.ongkir)}</span>
              </div>
            )}
          </div>

          {/* Points earned */}
          {data.pointsEarned > 0 && (
            <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg px-3 py-2 text-sm text-center text-orange-700 dark:text-orange-400">
              🎉 Pelanggan mendapat <strong>{data.pointsEarned} poin</strong> dari transaksi ini
            </div>
          )}
        </div>

        {/* Total & kembalian: selalu terlihat, tidak ikut ter-scroll */}
        <div className="shrink-0 space-y-1 border-t border-border bg-muted/40 px-5 py-3 text-sm">
          <div className="flex items-baseline justify-between gap-3 text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums text-[#028697]">{formatCurrency(data.total)}</span>
          </div>
          {data.cashReceived !== null && data.changeAmount !== null && (
            <>
              <div className="flex justify-between gap-3 text-muted-foreground">
                <span>Tunai diterima</span>
                <span className="tabular-nums">{formatCurrency(data.cashReceived)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-600 px-3 py-2 text-white">
                <span className="font-medium">Kembalian</span>
                <span className="text-lg font-bold tabular-nums">{formatCurrency(data.changeAmount)}</span>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 space-y-2 border-t border-border px-5 pb-5 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onPrint}>
              <Printer className="w-4 h-4 mr-1.5" />
              Cetak Struk
            </Button>
            <Button variant="outline" onClick={onShare}>
              <Share2 className="w-4 h-4 mr-1.5" />
              Bagikan
            </Button>
          </div>
          <Button
            autoFocus
            className="w-full h-11 bg-[#028697] hover:bg-[#017585] text-white font-semibold"
            onClick={onClose}
          >
            <Receipt className="w-4 h-4 mr-1.5" />
            Transaksi Baru
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function PosPanel({ variants, members, walkInCustomers, conversionRate, storeSlug, storeName, cashierName, combos = [] }: PosPanelProps) {
  // Notifikasi POS (satu aktif; yang baru menggantikan yang lama)
  const [notice, setNotice] = useState<PosNoticeData | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const dismissNotice = useCallback(() => { window.clearTimeout(noticeTimer.current); setNotice(null); }, []);
  const notify = useCallback((o: { title: string; description?: string; variant?: 'destructive' | 'success'; action?: { label: string; onClick: () => void }; duration?: number }) => {
    window.clearTimeout(noticeTimer.current);
    setNotice({
      id: Date.now(),
      tone: o.variant === 'destructive' ? 'error' : o.variant === 'success' ? 'success' : 'info',
      title: o.title,
      description: o.description,
      action: o.action,
    });
    noticeTimer.current = window.setTimeout(() => setNotice(null), o.duration ?? (o.action ? 6000 : 3500));
  }, []);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [comboCart, setComboCart] = useState<ComboCartLine[]>([]);
  const [viewMode, setViewMode] = useState<'products' | 'combos'>('products');
  const [pickerCombo, setPickerCombo] = useState<ComboInfo | null>(null);

  // Product filtering
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Customer
  const [customerType, setCustomerType] = useState<'customer' | 'member' | 'walk-in'>('customer');
  const [customerId, setCustomerId] = useState('');
  const [walkInCustomerId, setWalkInCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Checkout fields
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.PAID);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [ongkir, setOngkir] = useState(0);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [pointsDisplay, setPointsDisplay] = useState('');
  const [notes, setNotes] = useState('');
  // Modal "Opsi Lanjutan & Pembayaran" — muncul saat "Proses Transaksi" diklik
  const [showCheckout, setShowCheckout] = useState(false);
  const [reopenCartSheet, setReopenCartSheet] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showCart, setShowCart] = useState(false); // mobile cart toggle

  // Kecepatan & kenyamanan kasir
  const searchRef = useRef<HTMLInputElement>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [held, setHeld] = useState<HeldCart[]>([]);
  const [heldLoaded, setHeldLoaded] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);

  // ─── Derived data ─────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    const map = new Map<string, { name: string; icon: string | null; color: string | null }>();
    for (const v of variants) {
      if (v.category && !map.has(v.category.name)) {
        map.set(v.category.name, v.category);
      }
    }
    return Array.from(map.values());
  }, [variants]);

  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      const matchCat = activeCategory === 'all' || v.category?.name === activeCategory;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        v.product.name.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [variants, search, activeCategory]);

  const selectedMember = members.find((m) => m.id === customerId);
  const selectedWalkIn = walkInCustomers.find((m) => m.id === walkInCustomerId);
  const availablePoints = selectedMember?.points ?? 0;
  const pointDiscount = pointsToRedeem * conversionRate;

  const comboItemsTotal = comboCart.reduce((sum, l) => sum + l.itemsTotal, 0);
  const comboDiscount   = comboCart.reduce((sum, l) => sum + l.discount, 0);
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0) + comboItemsTotal;
  const total = roundMoney(Math.max(0, subtotal - comboDiscount - discount - pointDiscount + tax + ongkir));

  const pointsEarned =
    customerType === 'member' && customerId && pointsToRedeem === 0 && paymentStatus === PaymentStatus.PAID
      ? cart.reduce((sum, item) => {
          const v = variants.find((x) => x.id === item.variantId);
          return sum + (v?.pointsPerUnit ?? 0) * item.quantity;
        }, 0) + comboCart.reduce((sum, l) => sum + l.lines.reduce((s, x) => s + x.pointsPerUnit, 0), 0)
      : 0;

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0) + comboCart.length;
  const hasItems  = cart.length > 0 || comboCart.length > 0;

  // Pemakaian stok oleh isi paket di keranjang (digabung dengan item biasa saat cek stok)
  const comboUsage = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of comboCart) for (const x of l.lines) m.set(x.variantId, (m.get(x.variantId) ?? 0) + 1);
    return m;
  }, [comboCart]);

  const comboVariantMeta = useMemo(() => {
    const m = new Map<string, { stock: number; type: string }>();
    for (const c of combos) for (const sl of c.slots) for (const v of sl.variants) m.set(v.id, { stock: v.stock, type: v.type });
    return m;
  }, [combos]);

  const remainingForCombo = (variantId: string): number => {
    const meta = comboVariantMeta.get(variantId);
    if (!meta) return 0;
    if (meta.type === 'PREORDER') return Infinity;
    const inCart = cart.find((i) => i.variantId === variantId)?.quantity ?? 0;
    return meta.stock - inCart - (comboUsage.get(variantId) ?? 0);
  };

  // Paket bisa dijual bila setiap slot wajib punya minimal satu varian yang masih tersedia
  const comboAvailable = (c: ComboInfo): boolean => {
    const requiredOk = c.slots.every((sl) => !sl.isRequired || sl.variants.some((v) => remainingForCombo(v.id) >= 1));
    const anyOk = c.slots.some((sl) => sl.variants.some((v) => remainingForCombo(v.id) >= 1));
    return requiredOk && anyOk;
  };

  const filteredCombos = useMemo(() => {
    const q = search.toLowerCase();
    return combos.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [combos, search]);

  const customerName = useMemo(() => {
    if (customerType === 'customer') return 'Pelanggan Umum';
    if (customerType === 'member' && selectedMember) return selectedMember.name;
    if (customerType === 'walk-in' && selectedWalkIn) return selectedWalkIn.name;
    return 'Pelanggan Umum';
  }, [customerType, selectedMember, selectedWalkIn]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase();
    if (customerType === 'member') return members.filter((m) => m.name.toLowerCase().includes(q));
    if (customerType === 'walk-in') return walkInCustomers.filter((m) => m.name.toLowerCase().includes(q));
    return [];
  }, [customerType, customerSearch, members, walkInCustomers]);

  // ─── Cart actions ──────────────────────────────────────────────────────────

  const flash = useCallback((id: string) => {
    setFlashId(id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 700);
  }, []);

  const addToCart = useCallback(
    (variant: ProductVariant, quiet = false) => {
      const isPreorder = variant.type === 'PREORDER';
      if (!isPreorder && variant.stock - (comboUsage.get(variant.id) ?? 0) <= 0) {
        notify({ title: 'Stok Habis', description: `${variant.product.name} tidak tersedia.`, variant: 'destructive' });
        return;
      }
      flash(variant.id);
      if (!quiet) posFeedback('add', soundOn);
      setCart((prev) => {
        const existing = prev.find((i) => i.variantId === variant.id);
        if (existing) {
          if (!isPreorder && existing.quantity + (comboUsage.get(variant.id) ?? 0) >= variant.stock) {
            notify({ title: 'Stok Tidak Cukup', description: `Stok ${variant.product.name} hanya ${variant.stock}.`, variant: 'destructive' });
            return prev;
          }
          return prev.map((i) => i.variantId === variant.id ? { ...i, quantity: i.quantity + 1 } : i);
        }
        return [
          ...prev,
          {
            variantId: variant.id,
            variantName: variant.name,
            productName: variant.product.name,
            price: variant.price,
            quantity: 1,
            stock: variant.stock,
            isPreorder,
            emoji: getVariantEmoji(variant),
          },
        ];
      });
    },
    [notify, comboUsage, flash, soundOn]
  );

  const updateQty = useCallback((variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.variantId !== variantId) return i;
          const next = i.quantity + delta;
          if (next <= 0) return null as unknown as CartItem;
          if (!i.isPreorder && next + (comboUsage.get(variantId) ?? 0) > i.stock) return i;
          return { ...i, quantity: next };
        })
        .filter(Boolean)
    );
  }, [comboUsage]);

  const removeCombo = useCallback((key: string) => {
    const removed = comboCart.find((l) => l.key === key);
    setComboCart((prev) => prev.filter((l) => l.key !== key));
    if (!removed) return;
    notify({
      title: `Paket ${removed.name} dihapus`,
      action: { label: 'Batalkan', onClick: () => setComboCart((prev) => (prev.some((l) => l.key === removed.key) ? prev : [...prev, removed])) },
    });
  }, [comboCart, notify]);

  const removeFromCart = useCallback((variantId: string) => {
    const removed = cart.find((i) => i.variantId === variantId);
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));
    if (!removed) return;
    notify({
      title: `${removed.productName} dihapus`,
      action: { label: 'Batalkan', onClick: () => setCart((prev) => (prev.some((i) => i.variantId === removed.variantId) ? prev : [...prev, removed])) },
    });
  }, [cart, notify]);

  const resetAll = useCallback(() => {
    setCart([]);
    setComboCart([]);
    setDiscount(0);
    setTax(0);
    setOngkir(0);
    setPointsToRedeem(0); setPointsDisplay('');
    setNotes('');
    setCustomerType('customer');
    setCustomerId('');
    setWalkInCustomerId('');
    setCustomerSearch('');
    setShowCustomerDropdown(false);
    setPaymentStatus(PaymentStatus.PAID);
    setShowCheckout(false);
    setReopenCartSheet(false);
    setShowCart(false);
    setReceipt(null);
  }, []);

  // clearCart tetap ada untuk tombol "Kosongkan" di keranjang (tidak reset customer/payment)
  const clearCart = useCallback(() => {
    const snap = { cart, comboCart, discount, tax, ongkir, notes, pointsToRedeem };
    setCart([]);
    setComboCart([]);
    setDiscount(0);
    setTax(0);
    setOngkir(0);
    setPointsToRedeem(0); setPointsDisplay('');
    setNotes('');
    if (snap.cart.length === 0 && snap.comboCart.length === 0) return;
    notify({
      title: 'Keranjang dikosongkan',
      action: {
        label: 'Batalkan',
        onClick: () => {
          setCart(snap.cart); setComboCart(snap.comboCart);
          setDiscount(snap.discount); setTax(snap.tax); setOngkir(snap.ongkir); setNotes(snap.notes);
          setPointsToRedeem(snap.pointsToRedeem); setPointsDisplay(snap.pointsToRedeem ? String(snap.pointsToRedeem) : '');
        },
      },
      duration: 6000,
    });
  }, [cart, comboCart, discount, tax, ongkir, notes, pointsToRedeem, notify]);

  // ─── Customer selection ────────────────────────────────────────────────────

  const handleCustomerTypeChange = (type: 'customer' | 'member' | 'walk-in') => {
    setCustomerType(type);
    setCustomerId('');
    setWalkInCustomerId('');
    setCustomerSearch('');
    setShowCustomerDropdown(false);
    setPointsToRedeem(0);
    setPointsDisplay('');
  };

  const selectMember = (member: Member) => {
    setCustomerId(member.id);
    setCustomerSearch(member.name);
    setShowCustomerDropdown(false);
  };

  const selectWalkIn = (nm: WalkInCustomer) => {
    setWalkInCustomerId(nm.id);
    setCustomerSearch(nm.name);
    setShowCustomerDropdown(false);
  };

  // ─── Checkout ──────────────────────────────────────────────────────────────

  // Syarat membuka modal pembayaran: ada item & pelanggan valid.
  // Validasi diskon/pembayaran dilakukan di dalam modal.
  const canProceed =
    hasItems &&
    !loading &&
    (customerType === 'customer' ||
      (customerType === 'member' && !!customerId) ||
      (customerType === 'walk-in' && !!walkInCustomerId));

  const openCheckout = () => {
    if (!canProceed) return;
    // Bottom sheet keranjang (mobile) menutupi dialog (z-index lebih tinggi) → tutup sementara
    setReopenCartSheet(showCart);
    setShowCart(false);
    setShowCheckout(true);
  };

  const closeCheckout = (open: boolean) => {
    if (open) return;
    setShowCheckout(false);
    if (reopenCartSheet) setShowCart(true);
    setReopenCartSheet(false);
  };

  const handleCheckout = async (payload: CheckoutPayload) => {
    if (!canProceed) return;
    setLoading(true);
    try {
      const result = await createSaleAction({
        items: cart.map((i) => ({ variantId: i.variantId, quantity: i.quantity, price: i.price })),
        packages: comboCart.map((l) => ({ comboId: l.comboId, selections: l.selections })),
        customerId: customerType === 'walk-in' ? walkInCustomerId || null : null,
        memberId:   customerType === 'member'  ? customerId        || null : null,

        paymentMethod: payload.paymentMethod,
        payments: payload.payments,
        paymentStatus,
        discount,
        tax,
        ongkir,
        notes,
        pointsRedeemed: customerType === 'member' ? pointsToRedeem : 0,
      });

      if (result.success) {
        setShowCheckout(false);
        setReopenCartSheet(false);
        setShowCart(false); // tutup bottom sheet mobile sebelum receipt muncul
        const ok = result as unknown as CreateSaleOk;
        const payLabel = paymentMethodLabel(ok.paymentMethod);
        setReceipt({
          saleId: ok.saleId,
          saleNumber: ok.saleNumber,
          createdAt: ok.createdAt,
          items: [...cart],
          combos: ok.combos ?? [],
          comboDiscount: ok.comboDiscount ?? 0,
          customerName,
          paymentMethod: payLabel,
          payments: ok.payments ?? [],
          cashReceived: ok.cashReceived ?? null,
          changeAmount: ok.changeAmount ?? null,
          subtotal: ok.subtotal ?? subtotal,
          discount,
          tax,
          ongkir,
          pointDiscount,
          total: ok.total ?? total,
          pointsEarned,
          paymentStatus,
        });
      } else {
        notify({ title: 'Gagal', description: result.error ?? 'Terjadi kesalahan.', variant: 'destructive' });
      }
    } catch {
      notify({ title: 'Error', description: 'Terjadi kesalahan yang tidak terduga.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseReceipt = () => {
    resetAll();
    window.setTimeout(() => searchRef.current?.focus(), 50); // siap transaksi berikutnya
  };

  const handlePrintReceipt = () => {
    if (!receipt) return;
    const printWindow = window.open('', '_blank', 'width=420,height=600');
    if (!printWindow) return;

    // Semua teks buatan pengguna (nama produk/toko/pelanggan) di-escape: jendela cetak
    // memakai document.write, jadi HTML mentah di nama produk bisa menjalankan skrip.
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const itemsHTML = receipt.items.map((item) => `
      <div class="item">
        <div class="item-name">${esc(item.productName)}${item.variantName !== item.productName ? ` – ${esc(item.variantName)}` : ''}</div>
        <div class="item-line">
          <span>${item.quantity} x ${formatCurrency(item.price)}</span>
          <span>${formatCurrency(item.price * item.quantity)}</span>
        </div>
      </div>
    `).join('');

    const combosHTML = receipt.combos.map((c) => `
      <div class="item">
        <div class="item-name"><strong>${esc(c.name)}</strong></div>
        ${c.lines.map((l) => `
        <div class="item-line"><span>&nbsp;&nbsp;${esc(l.productName)}${l.variantName !== l.productName ? ` – ${esc(l.variantName)}` : ''}</span><span>${l.quantity} x ${formatCurrency(l.price)}</span></div>`).join('')}
        ${c.discount > 0 ? `<div class="item-line"><span>&nbsp;&nbsp;Diskon paket</span><span>- ${formatCurrency(c.discount)}</span></div>` : ''}
        <div class="item-line"><span>&nbsp;&nbsp;<strong>Harga paket</strong></span><span><strong>${formatCurrency(c.itemsTotal - c.discount)}</strong></span></div>
      </div>
    `).join('');

    const summaryRows = [
      ['Subtotal', formatCurrency(receipt.subtotal), false],
      ...(receipt.comboDiscount > 0 ? [['Diskon Paket', `- ${formatCurrency(receipt.comboDiscount)}`, false]] : []),
      ...(receipt.discount > 0    ? [['Diskon',     `- ${formatCurrency(receipt.discount)}`,     false]] : []),
      ...(receipt.pointDiscount > 0 ? [['Tukar Poin', `- ${formatCurrency(receipt.pointDiscount)}`, false]] : []),
      ...(receipt.tax > 0         ? [['Pajak',      formatCurrency(receipt.tax),                 false]] : []),
      ...(receipt.ongkir > 0      ? [['Ongkir',     formatCurrency(receipt.ongkir),               false]] : []),
    ].map(([label, value]) => `
      <div class="summary-row"><span>${label}</span><span>${value}</span></div>
    `).join('');

    const paymentsHTML = [
      ...(receipt.payments.length > 1
        ? receipt.payments.map((p) => `<div class="summary-row"><span>${esc(paymentMethodLabel(p.method))}</span><span>${formatCurrency(p.amount)}</span></div>`)
        : []),
      ...(receipt.cashReceived !== null && receipt.changeAmount !== null
        ? [
            `<div class="summary-row"><span>Tunai diterima</span><span>${formatCurrency(receipt.cashReceived)}</span></div>`,
            `<div class="summary-row"><strong>Kembalian</strong><strong>${formatCurrency(receipt.changeAmount)}</strong></div>`,
          ]
        : []),
    ].join('');

    const receiptHTML = `
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>Struk ${esc(receipt.saleNumber)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: #111;
    padding: 16px;
    max-width: 320px;
    margin: 0 auto;
  }
  .center  { text-align: center; }
  .store-name { font-size: 15px; font-weight: bold; }
  .meta    { font-size: 11px; color: #444; margin-top: 2px; }
  .divider { border-top: 1px dashed #999; margin: 10px 0; }
  .item    { margin-bottom: 6px; }
  .item-name { font-size: 12px; }
  .item-line { display: flex; justify-content: space-between; font-size: 12px; color: #333; }
  .summary-row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
  .total-row {
    display: flex; justify-content: space-between;
    font-size: 14px; font-weight: bold;
    border-top: 1px solid #111; margin-top: 6px; padding-top: 6px;
  }
  .footer  { text-align: center; font-size: 11px; color: #555; margin-top: 14px; }
  .btn-wrap { text-align: center; margin-top: 20px; }
  .btn {
    font-family: Arial, sans-serif;
    background: #028697; color: #fff; border: none;
    padding: 8px 20px; border-radius: 6px; font-size: 13px; cursor: pointer;
  }
  .btn.alt { background: #e5e7eb; color: #111; margin-left: 6px; }
  @page { margin: 4mm; }
  @media print {
    .btn-wrap { display: none; }
    body { padding: 0; }
  }
</style>
</head>
<body>
  <div class="center">
    <div class="store-name">${esc(storeName)}</div>
    <div class="meta">${esc(receipt.saleNumber)}</div>
    <div class="meta">${formatDateTime(receipt.createdAt)}</div>
    ${cashierName ? `<div class="meta">Kasir: ${esc(cashierName)}</div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="meta">Pelanggan: ${esc(receipt.customerName)}</div>
  <div class="meta">Bayar: ${esc(receipt.paymentMethod)}${receipt.paymentStatus === 'PENDING' ? ' (Pending)' : ''}</div>

  <div class="divider"></div>

  ${itemsHTML}
  ${combosHTML}

  <div class="divider"></div>

  ${summaryRows}
  <div class="total-row"><span>TOTAL</span><span>${formatCurrency(receipt.total)}</span></div>
  ${paymentsHTML}

  ${receipt.pointsEarned > 0 ? `<div class="footer">Poin didapat: ${receipt.pointsEarned}</div>` : ''}

  <div class="footer">Terima kasih atas kunjungan Anda 🙏</div>

  <div class="btn-wrap">
    <button class="btn" onclick="window.print()">Cetak Struk</button>
    <button class="btn alt" onclick="document.body.style.maxWidth='219px'">58mm</button>
    <button class="btn alt" onclick="document.body.style.maxWidth='302px'">80mm</button>
  </div>
</body>
</html>`;

    printWindow.document.write(receiptHTML);
    printWindow.document.close();
  };

  // ─── Cart panel (reused in desktop right column & mobile bottom sheet) ────

  // ─── Barcode, tahan transaksi, shortcut ────────────────────────────────────

  /** Tambahkan produk berdasarkan barcode. Mengembalikan teks hasil, atau null bila gagal. */
  const handleBarcode = useCallback((raw: string, toastErrors = true): string | null => {
    const code = raw.trim();
    const v = variants.find((x) => x.barcode && x.barcode === code);
    if (!v) {
      posFeedback('error', soundOn);
      if (toastErrors) notify({ title: 'Barcode tidak terdaftar', description: `"${code}" belum ada di katalog produk.`, variant: 'destructive' });
      return null;
    }
    if (v.type !== 'PREORDER' && v.stock - (comboUsage.get(v.id) ?? 0) <= 0) {
      posFeedback('error', soundOn);
      if (toastErrors) notify({ title: 'Stok Habis', description: `${v.product.name} tidak tersedia.`, variant: 'destructive' });
      return null;
    }
    addToCart(v, true);
    posFeedback('scan', soundOn);
    return `${v.product.name}${v.name !== v.product.name ? ` – ${v.name}` : ''} +1`;
  }, [variants, comboUsage, addToCart, notify, soundOn]);

  // Scanner USB/Bluetooth (mengetik cepat + Enter). Nonaktif saat ada dialog terbuka.
  const dialogOpen = showCheckout || !!receipt || !!pickerCombo || showHeld || showScanner;
  const onKeyboardScan = useCallback((code: string) => {
    handleBarcode(code);
    setSearch('');
  }, [handleBarcode]);
  useKeyboardBarcode(onKeyboardScan, !dialogOpen);

  // Enter di kolom pencarian: barcode persis → tambah; hasil tinggal satu → tambah
  const handleSearchEnter = () => {
    const q = search.trim();
    if (!q) return;
    if (variants.some((v) => v.barcode === q)) { handleBarcode(q); setSearch(''); return; }
    if (viewMode === 'products' && filteredVariants.length === 1) {
      addToCart(filteredVariants[0]);
      setSearch('');
    }
  };

  // Tahan transaksi — tersimpan di perangkat ini, per toko
  const heldKey = `pos-held:${storeSlug}`;
  useEffect(() => {
    setHeld(readStorage<HeldCart[]>(heldKey, []));
    setSoundOn(readStorage<boolean>('pos-sound', true));
    setHeldLoaded(true);
  }, [heldKey]);
  useEffect(() => { if (heldLoaded) writeStorage(heldKey, held); }, [held, heldLoaded, heldKey]);

  const toggleSound = () => {
    setSoundOn((on) => { writeStorage('pos-sound', !on); return !on; });
  };

  const snapshotHeld = (): HeldCart => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    heldAt: Date.now(),
    label: customerName,
    total,
    count: cartCount,
    cart,
    comboCart,
    customerType,
    customerId,
    walkInCustomerId,
    discount,
    tax,
    ongkir,
    notes,
    pointsToRedeem,
  });

  const holdCurrent = () => {
    if (!hasItems) return;
    if (held.length >= MAX_HELD) {
      notify({ title: 'Tahanan penuh', description: `Maksimal ${MAX_HELD} transaksi ditahan. Lanjutkan atau hapus salah satu dulu.`, variant: 'destructive' });
      return;
    }
    const h = snapshotHeld();
    setHeld((prev) => [h, ...prev]);
    resetAll();
    notify({ title: 'Transaksi ditahan', description: `${h.label} · ${formatCurrency(h.total)}` });
  };

  const resumeHeld = (h: HeldCart) => {
    // Harga & stok diselaraskan dengan katalog terkini (bisa berubah sejak ditahan)
    const byId = new Map(variants.map((v) => [v.id, v]));
    let adjusted = 0;
    const restored: CartItem[] = [];
    for (const it of h.cart) {
      const v = byId.get(it.variantId);
      if (!v) { adjusted++; continue; }
      const isPre = v.type === 'PREORDER';
      const qty = isPre ? it.quantity : Math.min(it.quantity, Math.max(v.stock, 0));
      if (qty <= 0) { adjusted++; continue; }
      if (qty !== it.quantity || v.price !== it.price) adjusted++;
      restored.push({ ...it, price: v.price, stock: v.stock, quantity: qty, isPreorder: isPre });
    }

    // Keranjang yang sedang berisi tidak hilang: otomatis ditahan menggantikan yang dilanjutkan
    const swapOut = hasItems ? snapshotHeld() : null;
    setHeld((prev) => [...(swapOut ? [swapOut] : []), ...prev.filter((x) => x.id !== h.id)].slice(0, MAX_HELD));

    const member = members.find((m) => m.id === h.customerId);
    const walkIn = walkInCustomers.find((m) => m.id === h.walkInCustomerId);
    const redeem = h.customerType === 'member' ? Math.min(h.pointsToRedeem, member?.points ?? 0) : 0;

    setCart(restored);
    setComboCart(h.comboCart);
    setCustomerType(h.customerType);
    setCustomerId(h.customerId);
    setWalkInCustomerId(h.walkInCustomerId);
    setCustomerSearch(member?.name ?? walkIn?.name ?? '');
    setShowCustomerDropdown(false);
    setDiscount(h.discount);
    setTax(h.tax);
    setOngkir(h.ongkir);
    setNotes(h.notes);
    setPointsToRedeem(redeem);
    setPointsDisplay(redeem ? String(redeem) : '');
    setShowHeld(false);
    notify({
      title: 'Transaksi dilanjutkan',
      description: adjusted > 0 ? `${adjusted} item disesuaikan dengan stok/harga terbaru.` : h.label,
    });
  };

  const discardHeld = (id: string) => setHeld((prev) => prev.filter((x) => x.id !== id));

  const handleShareReceipt = () => {
    if (!receipt) return;
    const text = buildReceiptText(receipt, storeName);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  // Shortcut keyboard (desktop): "/" atau F2 → pencarian, F9 → Proses Transaksi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialogOpen) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.key === 'F9') { e.preventDefault(); openCheckout(); return; }
      if (e.key === 'F2' || (e.key === '/' && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const hasAdjustments = comboDiscount > 0 || discount > 0 || pointDiscount > 0 || tax > 0 || ongkir > 0;

  const CartContent = (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-2">
            <ShoppingCart className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Keranjang kosong</p>
            <p className="text-xs text-muted-foreground/70">Klik produk untuk menambahkan</p>
          </div>
        ) : (
          <>
          {comboCart.map((line) => (
            <div key={line.key} className="space-y-1 rounded-lg border border-[#028697]/30 bg-[#028697]/5 p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-start gap-1 text-xs font-semibold">
                  <Layers className="h-3 w-3 shrink-0 text-[#028697]" />
                  <span className="line-clamp-2 break-words">{line.name}</span>
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-semibold">{formatCurrency(line.itemsTotal - line.discount)}</span>
                  <button
                    onClick={() => removeCombo(line.key)}
                    className="p-1.5 -mr-1.5 text-muted-foreground/50 transition-colors hover:text-destructive"
                    aria-label={`Hapus ${line.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <ul className="space-y-0.5">
                {line.lines.map((l) => (
                  <li key={l.variantId} className="flex justify-between text-[11px] text-muted-foreground">
                    <span className="break-words pr-2">{l.productName}{l.variantName !== l.productName ? ` – ${l.variantName}` : ''}</span>
                    <span className="shrink-0">{formatCurrency(l.price)}</span>
                  </li>
                ))}
                {line.discount > 0 && (
                  <li className="flex justify-between text-[11px] text-green-600">
                    <span>Diskon paket</span>
                    <span>− {formatCurrency(line.discount)}</span>
                  </li>
                )}
              </ul>
            </div>
          ))}
          {cart.map((item) => (
            <div
              key={item.variantId}
              className={cn(
                'rounded-xl border bg-background p-2.5 transition-colors duration-300',
                flashId === item.variantId ? 'border-[#028697]/60 bg-[#028697]/10' : 'border-border/70'
              )}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-sm font-semibold leading-snug" title={item.productName}>{item.productName}</p>
                  {item.variantName !== item.productName && (
                    <p className="break-words text-xs leading-snug text-muted-foreground">{item.variantName}</p>
                  )}
                </div>
                <button
                  onClick={() => removeFromCart(item.variantId)}
                  className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-red-50 hover:text-destructive"
                  aria-label="Hapus"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => (item.quantity <= 1 ? removeFromCart(item.variantId) : updateQty(item.variantId, -1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background transition-all hover:bg-muted active:scale-95 lg:h-8 lg:w-8"
                    aria-label="Kurangi"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.variantId, 1)}
                    disabled={!item.isPreorder && item.quantity + (comboUsage.get(item.variantId) ?? 0) >= item.stock}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background transition-all hover:bg-muted active:scale-95 disabled:opacity-40 lg:h-8 lg:w-8"
                    aria-label="Tambah"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="min-w-0 text-right">
                  <p className="whitespace-nowrap text-[11px] leading-none text-muted-foreground">{formatCurrency(item.price)} × {item.quantity}</p>
                  <p className="mt-1 whitespace-nowrap text-sm font-bold tabular-nums">{formatCurrency(item.price * item.quantity)}</p>
                </div>
              </div>
            </div>
          ))}
          </>
        )}
      </div>

      {/* Footer: Customer + Checkout */}
      {hasItems && (
        <div className="shrink-0 space-y-2.5 border-t border-border bg-card px-3 py-3">
          {/* Customer type tabs */}
          <div>
            <p className="sr-only">Jenis pelanggan</p>
            <div className="mb-2 flex gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Jenis pelanggan">
              {(['customer', 'member', 'walk-in'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleCustomerTypeChange(t)}
                  aria-pressed={customerType === t}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-xs font-medium transition-all',
                    customerType === t ? 'bg-background text-[#028697] shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t === 'customer' && <User className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{t === 'customer' ? 'Umum' : t === 'member' ? 'Member' : 'Non-Member'}</span>
                </button>
              ))}
            </div>

            {/* Customer search dropdown */}
            {customerType !== 'customer' && (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setCustomerId('');
                      setWalkInCustomerId('');
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder={customerType === 'member' ? 'Cari member...' : 'Cari customer...'}
                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-[#028697]"
                  />
                </div>
                {showCustomerDropdown && customerSearch && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 w-full mt-0.5 bg-white dark:bg-gray-900 border border-border rounded-md shadow-md max-h-36 overflow-y-auto">
                    {filteredCustomers.slice(0, 8).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => customerType === 'member' ? selectMember(c as Member) : selectWalkIn(c as WalkInCustomer)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                      >
                        <span className="font-medium">{c.name}</span>
                        {customerType === 'member' && (
                          <span className="text-muted-foreground ml-1.5">· {(c as Member).points} poin</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Points redemption (member only) */}
            {customerType === 'member' && customerId && availablePoints > 0 && (
              <div className="mt-2">
                <Label className="text-[11px] text-muted-foreground mb-1 block">
                  Tukar Poin (tersedia: {availablePoints})
                </Label>
                <Input
                  value={pointsDisplay}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    const val = Math.min(parseInt(raw || '0', 10), availablePoints);
                    setPointsToRedeem(val);
                    setPointsDisplay(raw ? String(val) : '');
                  }}
                  placeholder="0"
                  className="h-7 text-xs"
                />
                {pointsToRedeem > 0 && (
                  <p className="text-[11px] text-orange-600 mt-0.5">
                    = {formatCurrency(pointDiscount)} diskon
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Summary: rincian hanya muncul bila ada penyesuaian; Total selalu menonjol */}
          <div className="space-y-1 text-xs">
            {hasAdjustments && (
              <div className="space-y-1 px-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span className="tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                {comboDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Diskon Paket</span><span className="tabular-nums">− {formatCurrency(comboDiscount)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Diskon</span><span className="tabular-nums">− {formatCurrency(discount)}</span>
                  </div>
                )}
                {pointDiscount > 0 && (
                  <div className="flex justify-between text-orange-500">
                    <span>Tukar Poin</span><span className="tabular-nums">− {formatCurrency(pointDiscount)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pajak</span><span className="tabular-nums">{formatCurrency(tax)}</span>
                  </div>
                )}
                {ongkir > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Ongkir</span><span className="tabular-nums">{formatCurrency(ongkir)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#028697]/10 px-3 py-2">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold tabular-nums text-[#028697]">{formatCurrency(total)}</span>
            </div>
            {pointsEarned > 0 && (
              <p className="text-right text-[11px] text-orange-500">+{pointsEarned} poin diperoleh</p>
            )}
          </div>

          {/* Clear + Checkout */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearCart}
              className="shrink-0 h-9 px-2 text-destructive hover:text-destructive"
              aria-label="Kosongkan keranjang"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={holdCurrent}
              className="shrink-0 h-9 px-2.5"
              aria-label="Tahan transaksi"
              title="Tahan transaksi (simpan, layani pelanggan lain dulu)"
            >
              <Pause className="w-4 h-4" />
            </Button>
            <Button
              className="flex-1 h-9 bg-[#028697] hover:bg-[#017585] text-white font-semibold disabled:opacity-50 transition-colors"
              onClick={openCheckout}
              disabled={!canProceed}
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                Proses Transaksi
                <kbd className="ml-1 hidden rounded bg-white/20 px-1 text-[10px] font-medium xl:inline">F9</kbd>
              </span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {pickerCombo && (
        <ComboPickerDialog
          key={pickerCombo.id}
          combo={pickerCombo}
          onClose={() => setPickerCombo(null)}
          remaining={remainingForCombo}
          onAdd={(line) => setComboCart((prev) => [...prev, line])}
        />
      )}

      <CheckoutDialog
        open={showCheckout}
        onOpenChange={closeCheckout}
        loading={loading}
        customerName={customerName}
        subtotal={subtotal}
        comboDiscount={comboDiscount}
        pointDiscount={pointDiscount}
        pointsEarned={pointsEarned}
        total={total}
        discount={discount}
        tax={tax}
        ongkir={ongkir}
        notes={notes}
        onDiscountChange={setDiscount}
        onTaxChange={setTax}
        onOngkirChange={setOngkir}
        onNotesChange={setNotes}
        paymentStatus={paymentStatus === PaymentStatus.PENDING ? 'PENDING' : 'PAID'}
        onPaymentStatusChange={(st) => setPaymentStatus(st === 'PENDING' ? PaymentStatus.PENDING : PaymentStatus.PAID)}
        onConfirm={handleCheckout}
      />

      {/* Receipt overlay */}
      {receipt && (
        <ReceiptDialog
          data={receipt}
          storeName={storeName}
          cashierName={cashierName}
          onClose={handleCloseReceipt}
          onPrint={handlePrintReceipt}
          onShare={handleShareReceipt}
        />
      )}

      <ScannerDialog
        open={showScanner}
        onClose={() => { setShowScanner(false); window.setTimeout(() => searchRef.current?.focus(), 50); }}
        onDetected={(code) => handleBarcode(code, false)}
      />

      {/* Transaksi yang ditahan */}
      <Dialog open={showHeld} onOpenChange={setShowHeld}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-[460px] p-0 gap-0 overflow-hidden border-0 shadow-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0 bg-gradient-to-br from-[#028697] to-[#015561] px-5 py-4 pr-12 text-left space-y-0.5">
            <DialogTitle className="text-base font-semibold text-white">Transaksi Ditahan</DialogTitle>
            <p className="text-xs text-white/70">Tersimpan di perangkat ini · {held.length} dari {MAX_HELD}</p>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            {held.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada transaksi yang ditahan.</p>
            ) : (
              held.map((h) => (
                <div key={h.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{h.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {h.count} item · {new Date(h.heldAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-[#028697]">{formatCurrency(h.total)}</span>
                  <Button size="sm" className="h-9 shrink-0 bg-[#028697] text-white hover:bg-[#017585]" onClick={() => resumeHeld(h)}>
                    <Play className="mr-1 h-3.5 w-3.5" /> Lanjutkan
                  </Button>
                  <button
                    type="button"
                    onClick={() => discardHeld(h.id)}
                    className="shrink-0 p-2 text-muted-foreground/60 transition-colors hover:text-destructive"
                    aria-label={`Hapus transaksi tertahan ${h.label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative flex flex-col lg:flex-row gap-3 h-[calc(100dvh-13rem)] lg:h-[calc(100dvh-8.5rem)] lg:min-h-[560px]">
        <PosNotice notice={notice} onDismiss={dismissNotice} />
        {/* ── Left: Product browser ── */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
          {combos.length > 0 && (
            <div className="flex shrink-0 gap-1 rounded-xl bg-muted p-1">
              {(['products', 'combos'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
                    viewMode === mode ? 'bg-background text-[#028697] shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {mode === 'products' ? 'Produk' : `Paket (${combos.length})`}
                </button>
              ))}
            </div>
          )}

          {/* Search + scan + tertahan */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                ref={searchRef}
                data-barcode-ok
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchEnter(); } }}
                placeholder={viewMode === 'combos' ? 'Cari paket...' : 'Cari produk atau scan barcode...'}
                className="w-full h-10 pl-9 pr-9 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-[#028697]/50"
              />
              {search ? (
                <button
                  onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Hapus pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 text-[10px] text-muted-foreground lg:block">/</kbd>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-input bg-background text-[#028697] transition-colors hover:bg-[#028697]/5 active:scale-95"
              aria-label="Scan barcode dengan kamera"
              title="Scan barcode dengan kamera"
            >
              <ScanBarcode className="h-5 w-5" />
            </button>
            {held.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHeld(true)}
                className="relative flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-orange-300 bg-orange-50 px-3 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-100 active:scale-95 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400"
                aria-label={`${held.length} transaksi ditahan`}
              >
                <Pause className="h-4 w-4" />
                <span>{held.length}</span>
              </button>
            )}
            <button
              type="button"
              onClick={toggleSound}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-input bg-background text-muted-foreground transition-colors hover:text-foreground xl:flex"
              aria-label={soundOn ? 'Matikan bunyi scan' : 'Nyalakan bunyi scan'}
              title={soundOn ? 'Bunyi scan: nyala' : 'Bunyi scan: mati'}
            >
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>

          {/* Category pills */}
          {viewMode === 'products' && categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-0.5 py-1 -my-1 scrollbar-hide shrink-0">
              <button
                onClick={() => setActiveCategory('all')}
                className={cn(
                  'shrink-0 px-3.5 py-1.5 text-xs font-medium rounded-full border transition-colors',
                  activeCategory === 'all'
                    ? 'bg-[#028697] text-white border-[#028697]'
                    : 'bg-background border-border text-muted-foreground hover:border-[#028697]/60'
                )}
              >
                🛒 Semua
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setActiveCategory(cat.name)}
                  className={cn(
                    'shrink-0 px-3.5 py-1.5 text-xs font-medium rounded-full border transition-colors whitespace-nowrap',
                    activeCategory === cat.name
                      ? 'bg-[#028697] text-white border-[#028697]'
                      : 'bg-background border-border text-muted-foreground hover:border-[#028697]/60'
                  )}
                >
                  {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {viewMode === 'combos' ? (
              filteredCombos.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
                  <Layers className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Paket tidak ditemukan</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 pb-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredCombos.map((c) => {
                    const available = comboAvailable(c);
                    const inCart = comboCart.filter((l) => l.comboId === c.id).length;
                    return (
                      <button
                        key={c.id}
                        onClick={() => available && setPickerCombo(c)}
                        disabled={!available}
                        className={cn(
                          'relative space-y-1.5 rounded-xl border p-3 text-left transition-all',
                          !available
                            ? 'cursor-not-allowed border-border bg-muted opacity-50'
                            : inCart
                            ? 'border-[#028697] bg-[#028697]/5 shadow-sm hover:shadow-md'
                            : 'border-border bg-card hover:border-[#028697]/60 hover:shadow-sm'
                        )}
                      >
                        {inCart > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#028697] px-1 text-[10px] font-bold text-white">
                            {inCart}
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 shrink-0 text-[#028697]" />
                          <p className="truncate text-sm font-semibold">{c.name}</p>
                        </div>
                        <p className="text-sm font-bold text-[#028697]">{formatCurrency(c.price)}</p>
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">
                          {c.slots.map((sl) => sl.productName + (sl.variants.length > 1 ? ' (pilih)' : '')).join(' · ')}
                        </p>
                        {!available && (
                          <span className="inline-block rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600">Stok habis</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )
            ) : filteredVariants.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-16">
                <Search className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Produk tidak ditemukan</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 pb-28 lg:pb-14">
                {filteredVariants.map((variant) => {
                  const inCart = cart.find((i) => i.variantId === variant.id);
                  const isPreorder = variant.type === 'PREORDER';
                  const isOutOfStock = !isPreorder && variant.stock <= 0;
                  const isLow = !isPreorder && variant.stock > 0 && variant.stock <= 5;
                  const emoji = getVariantEmoji(variant);
                  const showVariant = variant.name !== variant.product.name;
                  const fullName = showVariant ? `${variant.product.name} – ${variant.name}` : variant.product.name;

                  return (
                    <button
                      key={variant.id}
                      onClick={() => !isOutOfStock && addToCart(variant)}
                      disabled={isOutOfStock}
                      title={fullName}
                      className={cn(
                        'group relative flex h-full min-w-0 flex-col rounded-2xl border p-3 text-left transition-all duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#028697]/60',
                        !isOutOfStock && 'cursor-pointer active:scale-[0.97] hover:-translate-y-0.5 hover:shadow-md',
                        flashId === variant.id && 'ring-2 ring-[#028697]/50 scale-[0.97]',
                        isOutOfStock
                          ? 'cursor-not-allowed border-border bg-muted/60'
                          : inCart
                          ? 'border-[#028697] bg-[#028697]/5 shadow-sm'
                          : 'border-border bg-card hover:border-[#028697]/50'
                      )}
                    >
                      {/* Ikon + penanda jumlah di keranjang (di dalam kartu: tidak terpotong area scroll) */}
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            'flex h-11 w-11 select-none items-center justify-center rounded-xl text-2xl leading-none',
                            isOutOfStock ? 'bg-muted grayscale' : 'bg-[#028697]/10'
                          )}
                        >
                          {emoji}
                        </span>
                        {inCart ? (
                          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#028697] px-1.5 text-xs font-bold text-white shadow-sm">
                            {inCart.quantity}
                          </span>
                        ) : isOutOfStock ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">Habis</span>
                        ) : null}
                      </div>

                      {/* Nama: sampai 2 baris, tinggi tetap agar semua kartu sejajar */}
                      <p className={cn('line-clamp-2 break-words text-[13px] font-semibold leading-tight', isOutOfStock && 'text-muted-foreground')}>
                        {showVariant ? variant.name : '\u00A0'}
                      </p>
                      <p className="mt-1 line-clamp-1 min-h-[1.1rem] break-all text-[11px] leading-snug text-muted-foreground">
                        {variant.product.name}
                      </p>

                      {/* Harga + stok ditumpuk (tidak bertabrakan di kartu sempit) */}
                      <div className="mt-auto pt-2">
                        <p className={cn('text-sm font-bold tabular-nums', isOutOfStock ? 'text-muted-foreground' : 'text-[#028697]')}>
                          {formatCurrency(variant.price)}
                        </p>
                        <p
                          className={cn(
                            'mt-1 flex items-center gap-1 text-[11px] font-medium',
                            isPreorder ? 'text-blue-600' : isOutOfStock ? 'text-red-500' : isLow ? 'text-orange-600' : 'text-emerald-600'
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 shrink-0 rounded-full',
                              isPreorder ? 'bg-blue-500' : isOutOfStock ? 'bg-red-500' : isLow ? 'bg-orange-500' : 'bg-emerald-500'
                            )}
                          />
                          {isPreorder ? 'Pre-order' : isOutOfStock ? 'Stok habis' : `Stok ${variant.stock}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Cart (desktop) ── */}
        <div className="hidden lg:flex lg:flex-col w-80 xl:w-96 shrink-0 border border-border rounded-2xl bg-card overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <ShoppingCart className="w-4 h-4 text-[#028697]" />
              Keranjang
            </div>
            {cartCount > 0 && (
              <span className="text-xs bg-[#028697] text-white rounded-full px-2 py-0.5 font-medium">
                {cartCount} item
              </span>
            )}
          </div>
          {CartContent}
        </div>

        {/* ── Mobile: floating cart button + bottom sheet ── */}
        <div className="lg:hidden">
          {hasItems && !showCart && (
            <div className="fixed inset-x-3 bottom-20 z-40 flex gap-2">
              <button
                onClick={() => setShowCart(true)}
                className="flex flex-1 items-center justify-between gap-3 rounded-2xl bg-[#028697] px-4 py-3 text-left text-white shadow-lg transition-transform active:scale-[0.98]"
                aria-label="Buka keranjang"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="relative">
                    <ShoppingCart className="h-5 w-5" />
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold">{cartCount}</span>
                  </span>
                  <span className="ml-1">{cartCount} item</span>
                </span>
                <span className="text-sm font-bold tabular-nums">{formatCurrency(total)}</span>
              </button>
              <button
                onClick={openCheckout}
                disabled={!canProceed}
                className="shrink-0 rounded-2xl bg-orange-500 px-5 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
              >
                Bayar
              </button>
            </div>
          )}

          {showCart && (
            <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) setShowCart(false); }}>
              <div className="bg-card rounded-t-3xl shadow-2xl flex flex-col max-h-[78dvh]">
                <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" aria-hidden />
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShoppingCart className="w-4 h-4 text-[#028697]" />
                    Keranjang
                    {cartCount > 0 && (
                      <span className="text-xs bg-[#028697] text-white rounded-full px-2 py-0.5 font-medium">
                        {cartCount} item
                      </span>
                    )}
                  </div>
                  <button onClick={() => setShowCart(false)} className="-mr-2 rounded-lg p-2 text-muted-foreground hover:text-foreground" aria-label="Tutup keranjang">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">
                  {CartContent}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}