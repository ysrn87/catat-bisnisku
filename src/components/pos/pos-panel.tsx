'use client';

import { useState, useMemo, useCallback } from 'react';
import { PaymentStatus } from '@prisma/client';
import { ShoppingCart, Search, User, ChevronDown, X, Plus, Minus, Trash2, CheckCircle, UserPlus, Receipt, Printer, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createSaleAction } from '@/actions/sales';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { ComboPickerDialog, type ComboCartLine } from './combo-picker-dialog';
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

interface ReceiptCombo {
  name: string;
  packagePrice: number;
  itemsTotal: number;
  discount: number;
  lines: Array<{ productName: string; variantName: string; price: number; quantity: number }>;
}

// Hasil createSaleAction yang sukses (nilai paket dihitung server)
interface CreateSaleOk {
  success: true;
  saleId: string;
  saleNumber: string;
  createdAt: Date;
  subtotal: number;
  comboDiscount: number;
  total: number;
  combos: ReceiptCombo[];
}

interface ReceiptData {
  saleId: string;
  saleNumber: string;
  createdAt: Date;
  items: CartItem[];
  customerName: string;
  paymentMethod: string;
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

const PAYMENT_METHODS = [
  { value: 'CASH',     label: 'Tunai' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'CARD',     label: 'Kartu' },
  { value: 'QRIS',     label: 'QRIS' },
];

const DEFAULT_EMOJI = '📦';

function getVariantEmoji(variant: ProductVariant): string {
  return variant.category?.icon || DEFAULT_EMOJI;
}

function parseNumber(val: string): number {
  const cleaned = val.replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

// ─── Receipt Dialog ────────────────────────────────────────────────────────────

function ReceiptDialog({
  data,
  storeName,
  cashierName,
  onClose,
  onPrint,
}: {
  data: ReceiptData;
  storeName: string;
  cashierName?: string;
  onClose: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl dark:bg-gray-900 overflow-hidden">
        {/* Header */}
        <div className="bg-[#028697] px-5 py-4 text-white text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircle className="w-6 h-6" />
            <span className="text-lg font-bold">Transaksi Berhasil!</span>
          </div>
          <p className="text-sm text-white/80">Pembayaran diterima</p>
        </div>

        {/* Receipt body */}
        <div className="px-5 py-4 space-y-4">
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
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Pembayaran</span>
            <span className="font-medium">{data.paymentMethod}</span>
          </div>
          {data.paymentStatus === 'PENDING' && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="text-yellow-600 font-medium">Pending</span>
            </div>
          )}

          {/* Items */}
          <div className="border-t border-dashed border-border pt-3 space-y-1.5">
            {data.items.map((item) => (
              <div key={item.variantId} className="flex justify-between text-sm">
                <span className="text-muted-foreground truncate max-w-[60%]">
                  {item.emoji} {item.productName}
                  {item.variantName !== item.productName ? ` – ${item.variantName}` : ''}
                  <span className="text-xs ml-1">×{item.quantity}</span>
                </span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}

            {data.combos.map((c, ci) => (
              <div key={ci} className="space-y-1 pt-1.5 first:pt-0">
                <p className="text-sm font-semibold">{c.name}</p>
                {c.lines.map((l, li) => (
                  <div key={li} className="flex justify-between gap-2 pl-3 text-sm">
                    <span className="truncate text-muted-foreground">
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
            <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
              <span>Total</span>
              <span className="text-[#028697]">{formatCurrency(data.total)}</span>
            </div>
          </div>

          {/* Points earned */}
          {data.pointsEarned > 0 && (
            <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg px-3 py-2 text-sm text-center text-orange-700 dark:text-orange-400">
              🎉 Pelanggan mendapat <strong>{data.pointsEarned} poin</strong> dari transaksi ini
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            <Receipt className="w-4 h-4 mr-1.5" />
            Selesai
          </Button>
          <Button
            className="flex-1 bg-[#028697] hover:bg-[#017585] text-white"
            onClick={onPrint}
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Cetak Struk
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function PosPanel({ variants, members, walkInCustomers, conversionRate, storeSlug, storeName, cashierName, combos = [] }: PosPanelProps) {
  const { toast } = useToast();

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
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.PAID);
  const [discount, setDiscount] = useState(0);
  const [discountDisplay, setDiscountDisplay] = useState('');
  const [tax, setTax] = useState(0);
  const [taxDisplay, setTaxDisplay] = useState('');
  const [ongkir, setOngkir] = useState(0);
  const [ongkirDisplay, setOngkirDisplay] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [pointsDisplay, setPointsDisplay] = useState('');
  const [notes, setNotes] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showCart, setShowCart] = useState(false); // mobile cart toggle

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
  const total = Math.max(0, subtotal - comboDiscount - discount - pointDiscount + tax + ongkir);

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

  const addToCart = useCallback(
    (variant: ProductVariant) => {
      const isPreorder = variant.type === 'PREORDER';
      if (!isPreorder && variant.stock - (comboUsage.get(variant.id) ?? 0) <= 0) {
        toast({ title: 'Stok Habis', description: `${variant.product.name} tidak tersedia.`, variant: 'destructive' });
        return;
      }
      setCart((prev) => {
        const existing = prev.find((i) => i.variantId === variant.id);
        if (existing) {
          if (!isPreorder && existing.quantity + (comboUsage.get(variant.id) ?? 0) >= variant.stock) {
            toast({ title: 'Stok Tidak Cukup', description: `Stok ${variant.product.name} hanya ${variant.stock}.`, variant: 'destructive' });
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
    [toast, comboUsage]
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
    setComboCart((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const removeFromCart = useCallback((variantId: string) => {
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const resetAll = useCallback(() => {
    setCart([]);
    setComboCart([]);
    setDiscount(0); setDiscountDisplay('');
    setTax(0); setTaxDisplay('');
    setOngkir(0); setOngkirDisplay('');
    setPointsToRedeem(0); setPointsDisplay('');
    setNotes('');
    setCustomerType('customer');
    setCustomerId('');
    setWalkInCustomerId('');
    setCustomerSearch('');
    setShowCustomerDropdown(false);
    setPaymentMethod('CASH');
    setPaymentStatus(PaymentStatus.PAID);
    setShowAdvanced(false);
    setShowCart(false);
    setReceipt(null);
  }, []);

  // clearCart tetap ada untuk tombol "Kosongkan" di keranjang (tidak reset customer/payment)
  const clearCart = useCallback(() => {
    setCart([]);
    setComboCart([]);
    setDiscount(0); setDiscountDisplay('');
    setTax(0); setTaxDisplay('');
    setOngkir(0); setOngkirDisplay('');
    setPointsToRedeem(0); setPointsDisplay('');
    setNotes('');
  }, []);

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

  const canCheckout =
    hasItems &&
    !loading &&
    (customerType === 'customer' ||
      (customerType === 'member' && !!customerId) ||
      (customerType === 'walk-in' && !!walkInCustomerId)) &&
    discount + comboDiscount + pointDiscount <= subtotal &&
    total >= 0;

  const handleCheckout = async () => {
    if (!canCheckout) return;
    setLoading(true);
    try {
      const result = await createSaleAction({
        items: cart.map((i) => ({ variantId: i.variantId, quantity: i.quantity, price: i.price })),
        packages: comboCart.map((l) => ({ comboId: l.comboId, selections: l.selections })),
        customerId: customerType === 'walk-in' ? walkInCustomerId || null : null,
        memberId:   customerType === 'member'  ? customerId        || null : null,

        paymentMethod,
        paymentStatus,
        discount,
        tax,
        ongkir,
        notes,
        pointsRedeemed: customerType === 'member' ? pointsToRedeem : 0,
      });

      if (result.success) {
        setShowCart(false); // tutup bottom sheet mobile sebelum receipt muncul
        const payLabel = PAYMENT_METHODS.find((p) => p.value === paymentMethod)?.label ?? paymentMethod;
        const ok = result as unknown as CreateSaleOk;
        setReceipt({
          saleId: ok.saleId,
          saleNumber: ok.saleNumber,
          createdAt: ok.createdAt,
          items: [...cart],
          combos: ok.combos ?? [],
          comboDiscount: ok.comboDiscount ?? 0,
          customerName,
          paymentMethod: payLabel,
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
        toast({ title: 'Gagal', description: result.error ?? 'Terjadi kesalahan.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan yang tidak terduga.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseReceipt = () => resetAll();

  const handlePrintReceipt = () => {
    if (!receipt) return;
    const printWindow = window.open('', '_blank', 'width=420,height=600');
    if (!printWindow) return;

    const itemsHTML = receipt.items.map((item) => `
      <div class="item">
        <div class="item-name">${item.productName}${item.variantName !== item.productName ? ` – ${item.variantName}` : ''}</div>
        <div class="item-line">
          <span>${item.quantity} x ${formatCurrency(item.price)}</span>
          <span>${formatCurrency(item.price * item.quantity)}</span>
        </div>
      </div>
    `).join('');

    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

    const receiptHTML = `
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>Struk ${receipt.saleNumber}</title>
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
  @media print {
    .btn-wrap { display: none; }
    body { padding: 0; }
  }
</style>
</head>
<body>
  <div class="center">
    <div class="store-name">${storeName}</div>
    <div class="meta">${receipt.saleNumber}</div>
    <div class="meta">${formatDateTime(receipt.createdAt)}</div>
    ${cashierName ? `<div class="meta">Kasir: ${cashierName}</div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="meta">Pelanggan: ${receipt.customerName}</div>
  <div class="meta">Bayar: ${receipt.paymentMethod}${receipt.paymentStatus === 'PENDING' ? ' (Pending)' : ''}</div>

  <div class="divider"></div>

  ${itemsHTML}
  ${combosHTML}

  <div class="divider"></div>

  ${summaryRows}
  <div class="total-row"><span>TOTAL</span><span>${formatCurrency(receipt.total)}</span></div>

  ${receipt.pointsEarned > 0 ? `<div class="footer">Poin didapat: ${receipt.pointsEarned}</div>` : ''}

  <div class="footer">Terima kasih atas kunjungan Anda 🙏</div>

  <div class="btn-wrap">
    <button class="btn" onclick="window.print()">Cetak Struk</button>
  </div>
</body>
</html>`;

    printWindow.document.write(receiptHTML);
    printWindow.document.close();
  };

  // ─── Cart panel (reused in desktop right column & mobile bottom sheet) ────

  const CartContent = (
    <div className="flex flex-col h-full">
      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
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
                <p className="flex min-w-0 items-center gap-1 text-xs font-semibold">
                  <Layers className="h-3 w-3 shrink-0 text-[#028697]" />
                  <span className="truncate">{line.name}</span>
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-semibold">{formatCurrency(line.itemsTotal - line.discount)}</span>
                  <button
                    onClick={() => removeCombo(line.key)}
                    className="text-muted-foreground/50 transition-colors hover:text-destructive"
                    aria-label={`Hapus ${line.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <ul className="space-y-0.5">
                {line.lines.map((l) => (
                  <li key={l.variantId} className="flex justify-between text-[11px] text-muted-foreground">
                    <span className="truncate pr-2">{l.productName}{l.variantName !== l.productName ? ` – ${l.variantName}` : ''}</span>
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
            <div key={item.variantId} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
              {/* <span className="text-lg leading-none shrink-0">{item.emoji}</span> */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground truncate">{item.productName}</p>
                {item.variantName !== item.productName && (
                  <p className="text-xs font-medium leading-snug truncate">{item.variantName}</p>
                )}
                <p className="text-[11px] text-muted-foreground">{formatCurrency(item.price)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => updateQty(item.variantId, -1)}
                  className="w-6 h-6 rounded-md border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors"
                  aria-label="Kurangi"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-xs font-medium">{item.quantity}</span>
                <button
                  onClick={() => updateQty(item.variantId, 1)}
                  disabled={!item.isPreorder && item.quantity + (comboUsage.get(item.variantId) ?? 0) >= item.stock}
                  className="w-6 h-6 rounded-md border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors disabled:opacity-40"
                  aria-label="Tambah"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="text-right shrink-0 min-w-[60px]">
                <p className="text-xs font-semibold">{formatCurrency(item.price * item.quantity)}</p>
              </div>
              <button
                onClick={() => removeFromCart(item.variantId)}
                className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0"
                aria-label="Hapus"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          </>
        )}
      </div>

      {/* Footer: Customer + Checkout */}
      {hasItems && (
        <div className="border-t border-border px-3 py-3 space-y-3 shrink-0">
          {/* Customer type tabs */}
          <div>
            <Label className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
              <User className="w-3 h-3" /> Pelanggan
            </Label>
            <div className="flex gap-1 mb-2">
              {(['customer', 'member', 'walk-in'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleCustomerTypeChange(t)}
                  className={cn(
                    'flex-1 text-[11px] py-1 px-1 rounded-md border transition-colors',
                    customerType === t
                      ? 'bg-[#028697] text-white border-[#028697]'
                      : 'bg-background border-border text-muted-foreground hover:border-[#028697]/50'
                  )}
                >
                  {t === 'customer' ? 'Umum' : t === 'member' ? 'Member' : 'Non-Member'}
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

          {/* Advanced: Diskon / Pajak / Ongkir / Catatan */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <ChevronDown className={cn('w-3 h-3 transition-transform', showAdvanced && 'rotate-180')} />
              Opsi Lanjutan (Diskon, Pajak, Ongkir)
            </button>
            {showAdvanced && (
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Diskon (Rp)', val: discountDisplay, set: setDiscountDisplay, setState: setDiscount },
                  { label: 'Pajak (Rp)', val: taxDisplay, set: setTaxDisplay, setState: setTax },
                  { label: 'Ongkir (Rp)', val: ongkirDisplay, set: setOngkirDisplay, setState: setOngkir },
                ].map(({ label, val, set, setState }) => (
                  <div key={label}>
                    <Label className="text-[10px] text-muted-foreground">{label}</Label>
                    <Input
                      value={val}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        set(raw);
                        setState(parseNumber(raw));
                      }}
                      placeholder="0"
                      className="h-7 text-xs mt-0.5"
                    />
                  </div>
                ))}
                <div className="col-span-3">
                  <Label className="text-[10px] text-muted-foreground">Metode Bayar</Label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full mt-0.5 h-7 text-xs border border-input rounded-md bg-background px-2 focus:outline-none focus:ring-1 focus:ring-[#028697]"
                  >
                    {PAYMENT_METHODS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <Label className="text-[10px] text-muted-foreground">Status Bayar</Label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full mt-0.5 h-7 text-xs border border-input rounded-md bg-background px-2 focus:outline-none focus:ring-1 focus:ring-[#028697]"
                  >
                    <option value="PAID">Lunas</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
                <div className="col-span-3">
                  <Label className="text-[10px] text-muted-foreground">Catatan</Label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Catatan tambahan..."
                    rows={2}
                    className="w-full mt-0.5 text-xs border border-input rounded-md bg-background p-2 focus:outline-none focus:ring-1 focus:ring-[#028697] resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-1 text-xs pt-1 border-t border-border">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </div>
            {comboDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Diskon Paket</span><span>− {formatCurrency(comboDiscount)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Diskon</span><span>− {formatCurrency(discount)}</span>
              </div>
            )}
            {pointDiscount > 0 && (
              <div className="flex justify-between text-orange-500">
                <span>Tukar Poin</span><span>− {formatCurrency(pointDiscount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Pajak</span><span>{formatCurrency(tax)}</span>
              </div>
            )}
            {ongkir > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Ongkir</span><span>{formatCurrency(ongkir)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-1">
              <span>Total</span>
              <span className="text-[#028697]">{formatCurrency(total)}</span>
            </div>
            {pointsEarned > 0 && (
              <p className="text-[11px] text-orange-500 text-right">+{pointsEarned} poin diperoleh</p>
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
              className="flex-1 h-9 bg-[#028697] hover:bg-[#017585] text-white font-semibold disabled:opacity-50 transition-colors"
              onClick={handleCheckout}
              disabled={!canCheckout}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  Proses Transaksi
                </span>
              )}
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

      {/* Receipt overlay */}
      {receipt && (
        <ReceiptDialog
          data={receipt}
          storeName={storeName}
          cashierName={cashierName}
          onClose={handleCloseReceipt}
          onPrint={handlePrintReceipt}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-3 h-[calc(100vh-10rem)] lg:h-[calc(100vh-9rem)] min-h-[600px]">
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

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={viewMode === 'combos' ? 'Cari paket...' : 'Cari produk...'}
              className="w-full pl-9 pr-4 py-2 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-[#028697]/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category pills */}
          {viewMode === 'products' && categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide shrink-0">
              <button
                onClick={() => setActiveCategory('all')}
                className={cn(
                  'shrink-0 px-3 py-1 text-xs rounded-full border transition-colors',
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
                    'shrink-0 px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap',
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 pb-4">
                {filteredVariants.map((variant) => {
                  const inCart = cart.find((i) => i.variantId === variant.id);
                  const isOutOfStock = variant.type !== 'PREORDER' && variant.stock <= 0;
                  const emoji = getVariantEmoji(variant);

                  return (
                    <button
                      key={variant.id}
                      onClick={() => !isOutOfStock && addToCart(variant)}
                      disabled={isOutOfStock}
                      className={cn(
                        'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-left transition-all',
                        isOutOfStock
                          ? 'opacity-50 cursor-not-allowed bg-muted border-border'
                          : inCart
                          ? 'bg-[#028697]/5 border-[#028697] shadow-sm hover:shadow-md cursor-pointer'
                          : 'bg-card border-border hover:border-[#028697]/60 hover:shadow-sm cursor-pointer'
                      )}
                    >
                      {/* Cart qty badge */}
                      {inCart && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 rounded-full bg-[#028697] text-white text-[10px] font-bold flex items-center justify-center px-1 z-10">
                          {inCart.quantity}
                        </span>
                      )}

                      {/* Emoji */}
                      <span className="text-3xl leading-none select-none">{emoji}</span>

                      {/* Name */}
                      <div className="w-full text-center">
                        <p className="text-[10px] text-muted-foreground truncate">{variant.product.name}</p>
                        {variant.name !== variant.product.name && (
                          <p className="text-[11px] font-semibold leading-snug line-clamp-2">{variant.name}</p>
                        )}
                      </div>

                      {/* Price */}
                      <p className="text-xs font-bold text-[#028697]">{formatCurrency(variant.price)}</p>

                      {/* Stock */}
                      {variant.type === 'PREORDER' ? (
                        <span className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full">
                          Pre-order
                        </span>
                      ) : variant.stock <= 5 ? (
                        <span className="text-[10px] text-orange-600 bg-orange-50 dark:bg-orange-950/30 px-1.5 py-0.5 rounded-full">
                          Stok: {variant.stock}
                        </span>
                      ) : (
                        <span className="text-[10px] text-green-600 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded-full">
                          Stok: {variant.stock}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Cart (desktop) ── */}
        <div className="hidden lg:flex lg:flex-col w-72 xl:w-80 shrink-0 border border-border rounded-2xl bg-card overflow-hidden">
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
            <div className="fixed bottom-20 right-4 z-40">
              <button
                onClick={() => setShowCart(true)}
                className="relative flex items-center gap-2 bg-[#028697] text-white px-4 py-3 rounded-2xl shadow-lg font-semibold text-sm active:scale-95 transition-transform"
              >
                <ShoppingCart className="w-5 h-5" />
                <span>{cartCount} item · {formatCurrency(total)}</span>
                <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              </button>
            </div>
          )}

          {showCart && (
            <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50">
              <div className="bg-card rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShoppingCart className="w-4 h-4 text-[#028697]" />
                    Keranjang
                    {cartCount > 0 && (
                      <span className="text-xs bg-[#028697] text-white rounded-full px-2 py-0.5 font-medium">
                        {cartCount} item
                      </span>
                    )}
                  </div>
                  <button onClick={() => setShowCart(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 pb-[env(safe-area-inset-bottom)]">
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