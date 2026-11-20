'use client';

import { useState, useEffect, useMemo } from 'react';
import { PaymentStatus } from '@prisma/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { updateSaleAction, type UpdateSalePackageInput } from '@/actions/sales';
import { ComboPickerDialog } from '@/components/pos/combo-picker-dialog';
import type { ComboInfo, ComboSelections } from '@/lib/combo-pricing';
import {
  Trash2, Gift, Plus, Minus, Search, X, Package,
  ShoppingCart, CreditCard, FileText, Pencil, Check, Layers,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface EditSaleDialogProps {
  sale: {
    id: string;
    saleNumber?: string;
    customerId: string | null;
    memberId?: string | null;
    paymentMethod: string;
    paymentStatus?: string;
    discount: number;
    tax: number;
    ongkir: number;
    notes: string | null;
    pointsRedeemed?: number;
    customer?: { name: string } | null;
    nonMemberCustomer?: { name: string } | null;
    combos?: Array<{
      id: string;
      comboId?: string | null;
      name: string;
      packagePrice: number;
      itemsTotal: number;
      discount: number;
    }>;
    items: Array<{
      id: string;
      saleComboId?: string | null;
      quantity: number;
      price: number;
      variant: {
        id: string;
        name: string;
        stock: number;
        type?: string;
        product: { name: string };
      };
    }>;
  };
  variants?: Array<{
    id: string;
    name: string;
    price: number;
    stock: number;
    pointsPerUnit: number;
    type?: string;
    product: { name: string };
  }>;
  /** Paket aktif (untuk mengubah isi / menambah paket). */
  combos?: ComboInfo[];
  conversionRate?: number;
  userRole?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/** Paket di dalam transaksi yang sedang diedit. keep = tidak diubah (snapshot dipertahankan). */
interface EditPackage {
  key:         string;
  saleComboId?: string;
  comboId:     string | null;
  name:        string;
  keep:        boolean;
  selections?: ComboSelections;
  lines:       Array<{ variantId: string; productName: string; variantName: string; price: number }>;
  itemsTotal:  number;
  discount:    number;
}

interface SaleItem {
  variantId: string;
  variantName: string;
  productName: string;
  quantity: number;
  price: number;
  currentStock: number;
  type?: string;
  priceDisplay?: string;
}

export function EditSaleDialog({
  sale,
  variants = [],
  combos = [],
  conversionRate = 1000,
  userRole,
  open,
  onOpenChange,
  onSuccess,
}: EditSaleDialogProps) {
  // Sale.discount = diskon manual + diskon paket; form hanya mengedit bagian MANUAL
  const manualDiscountInit = Math.max(0, sale.discount - (sale.combos ?? []).reduce((s, c) => s + c.discount, 0));

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [packages, setPackages] = useState<EditPackage[]>([]);
  const [picker, setPicker] = useState<{ combo: ComboInfo; editKey?: string; initial?: ComboSelections } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>(sale.paymentMethod);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    (sale.paymentStatus as PaymentStatus) || PaymentStatus.PAID,
  );
  const [discount, setDiscount] = useState<number>(manualDiscountInit);
  const [discountDisplay, setDiscountDisplay] = useState(
    manualDiscountInit > 0 ? manualDiscountInit.toLocaleString('en-US') : '',
  );
  const [tax, setTax] = useState<number>(sale.tax);
  const [taxDisplay, setTaxDisplay] = useState(
    sale.tax > 0 ? sale.tax.toLocaleString('en-US') : '',
  );
  const [ongkir, setOngkir] = useState<number>(sale.ongkir || 0);
  const [ongkirDisplay, setOngkirDisplay] = useState(
    sale.ongkir > 0 ? sale.ongkir.toLocaleString('en-US') : '',
  );
  const [notes, setNotes] = useState<string>(sale.notes || '');

  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [quantityDisplay, setQuantityDisplay] = useState('1');
  const [productSearch, setProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  const { toast } = useToast();

  const canManageProducts = userRole === 'OWNER' || userRole === 'ADMINISTRATOR' || userRole === 'MANAGER';
  const pointsRedeemed = sale.pointsRedeemed || 0;
  const pointDiscount = pointsRedeemed * conversionRate;
  const customerName = sale.customer?.name ?? sale.nonMemberCustomer?.name ?? 'Pelanggan Umum';

  useEffect(() => {
    setPackages(
      (sale.combos ?? []).map((c) => ({
        key: c.id,
        saleComboId: c.id,
        comboId: c.comboId ?? null,
        name: c.name,
        keep: true,
        lines: sale.items
          .filter((i) => i.saleComboId === c.id)
          .map((i) => ({ variantId: i.variant.id, productName: i.variant.product.name, variantName: i.variant.name, price: i.price })),
        itemsTotal: c.itemsTotal,
        discount: c.discount,
      })),
    );
    setItems(
      sale.items.filter((item) => !item.saleComboId).map((item) => ({
        variantId: item.variant.id,
        variantName: item.variant.name,
        productName: item.variant.product.name,
        quantity: item.quantity,
        price: item.price,
        currentStock: item.variant.stock + item.quantity,
        type: item.variant.type,
        priceDisplay: item.price.toLocaleString('en-US'),
      })),
    );
  }, [sale]);

  const itemsSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const packagesItemsTotal = packages.reduce((sum, p) => sum + p.itemsTotal, 0);
  const packagesDiscount = packages.reduce((sum, p) => sum + p.discount, 0);
  const subtotal = itemsSubtotal + packagesItemsTotal;
  const total = subtotal - discount - packagesDiscount - pointDiscount + tax + ongkir;

  // ── Paket: ketersediaan stok untuk pemilih (stok sekarang + qty transaksi ini yang akan dikembalikan)
  const comboVariantMeta = useMemo(() => {
    const m = new Map<string, { stock: number; type: string }>();
    for (const c of combos) for (const sl of c.slots) for (const v of sl.variants) m.set(v.id, { stock: v.stock, type: v.type });
    return m;
  }, [combos]);

  const packageUsage = (variantId: string, excludeKey?: string) =>
    packages.filter((p) => p.key !== excludeKey).reduce((s, p) => s + p.lines.filter((l) => l.variantId === variantId).length, 0);

  const remainingForCombo = (variantId: string, excludeKey?: string): number => {
    const meta = comboVariantMeta.get(variantId);
    if (!meta) return 0;
    if (meta.type === 'PREORDER') return Infinity;
    const oldQty = sale.items.filter((i) => i.variant.id === variantId).reduce((s, i) => s + i.quantity, 0);
    const usedInItems = items.filter((i) => i.variantId === variantId).reduce((s, i) => s + i.quantity, 0);
    return meta.stock + oldQty - usedInItems - packageUsage(variantId, excludeKey);
  };

  const removePackage = (key: string) => setPackages((prev) => prev.filter((p) => p.key !== key));

  const openEditPackage = (pkg: EditPackage) => {
    const combo = combos.find((c) => c.id === pkg.comboId);
    if (!combo) {
      toast({ title: 'Paket tidak tersedia', description: 'Paket ini sudah dihapus atau dinonaktifkan. Hapus dari transaksi lalu tambah paket lain jika perlu.', variant: 'destructive' });
      return;
    }
    const initial: ComboSelections = pkg.selections ?? Object.fromEntries(
      combo.slots.flatMap((slot) => {
        const line = pkg.lines.find((l) => slot.variants.some((v) => v.id === l.variantId));
        return line ? [[slot.id, line.variantId]] : [];
      }),
    );
    setPicker({ combo, editKey: pkg.key, initial });
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    const newItems = [...items];
    if (newItems[index].type === 'PREORDER' || newQty + packageUsage(newItems[index].variantId) <= newItems[index].currentStock) {
      newItems[index].quantity = newQty;
      setItems(newItems);
    }
  };

  const updatePrice = (index: number, raw: string) => {
    const num = parseInt(raw.replace(/\D/g, '')) || 0;
    const newItems = [...items];
    newItems[index].price = num;
    newItems[index].priceDisplay = num > 0 ? num.toLocaleString('en-US') : '';
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const filteredVariants = variants
    .filter((v) => v.type === 'PREORDER' || v.stock > 0)
    .filter(
      (v) =>
        !productSearch ||
        v.product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        v.name.toLowerCase().includes(productSearch.toLowerCase()),
    );

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);

  const addItem = () => {
    if (!selectedVariantId || quantity <= 0) {
      toast({ title: 'Error', description: 'Pilih produk dan masukkan jumlah.', variant: 'destructive' });
      return;
    }
    const variant = variants.find((v) => v.id === selectedVariantId);
    if (!variant) return;
    if (variant.type !== 'PREORDER' && quantity > variant.stock) {
      toast({ title: 'Error', description: `Stok tersedia hanya ${variant.stock} unit.`, variant: 'destructive' });
      return;
    }
    const existingIndex = items.findIndex((item) => item.variantId === selectedVariantId);
    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex].quantity += quantity;
      setItems(newItems);
    } else {
      setItems([
        ...items,
        {
          variantId: variant.id,
          variantName: variant.name,
          productName: variant.product.name,
          quantity,
          price: variant.price,
          currentStock: variant.stock,
          type: variant.type,
          priceDisplay: variant.price.toLocaleString('en-US'),
        },
      ]);
    }
    setSelectedVariantId('');
    setQuantity(1);
    setQuantityDisplay('1');
    setProductSearch('');
    setIsProductDropdownOpen(false);
  };

  const handleSubmit = async () => {
    if (items.length === 0 && packages.length === 0) {
      toast({ title: 'Error', description: 'Penjualan harus ada min. 1 item.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const result = await updateSaleAction(sale.id, {
        items: items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          price: item.price,
        })),
        packages: packages.map<UpdateSalePackageInput>((p) =>
          p.keep && p.saleComboId
            ? { saleComboId: p.saleComboId, keep: true }
            : { comboId: p.comboId as string, selections: p.selections ?? {}, ...(p.saleComboId ? { saleComboId: p.saleComboId } : {}) },
        ),
        customerId: sale.customerId || null,
        paymentMethod,
        paymentStatus,
        discount,
        tax,
        ongkir,
        notes: notes || undefined,
        pointsRedeemed,
      });

      if (result.success) {
        toast({ title: 'Berhasil!', description: 'Penjualan berhasil diupdate.' });
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        toast({ title: 'Error', description: result.error || 'Gagal update penjualan.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan yang tidak terduga.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="w-[95vw] max-w-[95vw] sm:max-w-[680px] min-h-[80vh] max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0"
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
              <Pencil className="w-4 h-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-gray-900 text-left">
                Edit Penjualan — {customerName}
              </DialogTitle>
              <p className="text-xs text-gray-400 mt-0.5 text-left">
                Perbarui transaksi{sale.saleNumber && (
                  <span className="font-semibold text-gray-600"> {sale.saleNumber}</span>
                )}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* 1. PELANGGAN */}
          <section className="space-y-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Pelanggan</span>
            <div className="flex items-center gap-2.5 min-h-[46px] px-3 py-2 border border-gray-200 rounded-xl bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                {customerName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{customerName}</p>
                <p className="text-xs text-gray-400">{sale.customer ? 'Member' : 'Non-Member'}</p>
              </div>
              <span className="text-[10px] text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full font-medium shrink-0">
                Tidak dapat diubah
              </span>
            </div>
          </section>

          {/* 2. KERANJANG */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Keranjang</span>
              </div>
              {items.length + packages.length > 0 && (
                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
                  {items.length + packages.length} item · {items.reduce((s, i) => s + i.quantity, 0) + packages.length} pcs
                </span>
              )}
            </div>

            {items.length === 0 && packages.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl py-7 flex flex-col items-center gap-1.5 bg-gray-50/40">
                <ShoppingCart className="w-6 h-6 text-gray-300" />
                <p className="text-sm font-medium text-gray-400">Keranjang kosong</p>
              </div>
            ) : (
              <div className="space-y-2">
              {items.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Table header */}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Produk</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</span>
                </div>

                {/* Item rows */}
                <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                  {items.map((item, index) => (
                    <div key={index} className="px-3 py-3 hover:bg-gray-50/60 transition-colors space-y-0.5">

                      {/* Row 1 — Variant name (left) · Delete icon (right) */}
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 leading-snug break-words flex-1">
                          {item.variantName}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={loading || items.length + packages.length === 1}
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Row 2 — Product name */}
                      <p className="text-xs text-amber-600 leading-snug break-words">
                        {item.productName}
                      </p>

                      {/* Row 3 — Price (editable or read-only) */}
                      <div className="pt-0.5">
                        {canManageProducts ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 shrink-0">Rp</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={item.priceDisplay ?? item.price.toLocaleString('en-US')}
                              onChange={(e) => updatePrice(index, e.target.value)}
                              disabled={loading}
                              className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 w-28 focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">{formatCurrency(item.price)}/pcs</p>
                        )}
                      </div>

                      {/* Row 4 — Qty stepper (left) · Row total (right) */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateQuantity(index, item.quantity - 1)}
                            disabled={loading || item.quantity <= 1}
                            className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold text-gray-800 w-7 text-center tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(index, item.quantity + 1)}
                            disabled={loading || (item.type !== 'PREORDER' && item.quantity >= item.currentStock)}
                            className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>

                      {/* Row 5 — Stock info */}
                      <p className="text-[10px] text-gray-300 pt-0.5">
                        {item.type === 'PREORDER' ? 'Pre Order' : `Stok: ${item.currentStock} pcs`}
                      </p>

                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Paket di transaksi */}
              {packages.map((pkg) => (
                <div key={pkg.key} className="border border-amber-200 bg-amber-50/40 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 min-w-0">
                      <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">{pkg.name}</span>
                      {!pkg.keep && (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">diubah</span>
                      )}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(pkg.itemsTotal - pkg.discount)}</span>
                      <button
                        type="button"
                        onClick={() => removePackage(pkg.key)}
                        disabled={loading || items.length + packages.length === 1}
                        aria-label={`Hapus ${pkg.name}`}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <ul className="space-y-0.5">
                    {pkg.lines.map((l) => (
                      <li key={l.variantId} className="flex justify-between gap-2 text-xs text-gray-500">
                        <span className="truncate">{l.productName}{l.variantName !== l.productName ? ` – ${l.variantName}` : ''}</span>
                        <span className="shrink-0 tabular-nums">{formatCurrency(l.price)}</span>
                      </li>
                    ))}
                    {pkg.discount > 0 && (
                      <li className="flex justify-between text-xs text-emerald-600">
                        <span>Diskon paket</span>
                        <span className="tabular-nums">−{formatCurrency(pkg.discount)}</span>
                      </li>
                    )}
                  </ul>
                  {canManageProducts && (
                    <button
                      type="button"
                      onClick={() => openEditPackage(pkg)}
                      disabled={loading}
                      className="text-xs font-medium text-amber-700 hover:text-amber-800 disabled:opacity-50"
                    >
                      Ubah isi paket
                    </button>
                  )}
                </div>
              ))}
              </div>
            )}
          </section>

          {/* 3. TAMBAH PRODUK (admin/manager only) */}
          {!canManageProducts && (
            <p className="text-[11px] text-gray-400 italic px-1">
              Hanya Owner/Admin/Manager yang dapat menambah produk ke transaksi yang sudah dibuat.
            </p>
          )}
          {canManageProducts && variants.length === 0 && (
            <p className="text-[11px] text-gray-400 italic px-1">
              Tidak ada produk dengan stok tersedia untuk ditambahkan.
            </p>
          )}
          {canManageProducts && variants.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Tambah Produk</span>
              </div>
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/40 space-y-2.5">
                {selectedVariant && (
                  <div className="flex items-center gap-2.5 p-2.5 bg-white border border-amber-200 rounded-lg shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 break-words leading-snug">
                        {selectedVariant.product.name}
                        {selectedVariant.type === 'PREORDER' && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Pre-Order</span>
                        )}
                      </p>
                      {selectedVariant.name !== selectedVariant.product.name && (
                        <p className="text-xs text-amber-600 font-medium leading-tight">
                          {selectedVariant.name}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatCurrency(selectedVariant.price)} · {selectedVariant.type === 'PREORDER' ? 'Pre Order' : `Stok: ${selectedVariant.stock}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedVariantId(''); setProductSearch(''); }}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Cari nama produk..."
                    value={productSearch}
                    onChange={(e) => { setProductSearch(e.target.value); setIsProductDropdownOpen(true); }}
                    onFocus={() => setIsProductDropdownOpen(true)}
                    className="pl-8 h-9 text-sm border-gray-200 rounded-lg bg-white"
                  />
                </div>
                {isProductDropdownOpen && productSearch && (
                  <div className="border border-gray-200 rounded-lg bg-white shadow-md max-h-[180px] overflow-y-auto">
                    {filteredVariants.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-400">Produk tidak ditemukan</div>
                    ) : (
                      filteredVariants.map((variant) => (
                        <div
                          key={variant.id}
                          onClick={() => { setSelectedVariantId(variant.id); setIsProductDropdownOpen(false); setProductSearch(''); }}
                          className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 ${selectedVariantId === variant.id ? 'bg-amber-50' : ''}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 break-words leading-snug">
                              {variant.product.name}
                              {variant.type === 'PREORDER' && (
                                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Pre-Order</span>
                              )}
                            </p>
                            {variant.name !== variant.product.name && (
                              <p className="text-xs text-amber-600 font-medium leading-tight">
                                {variant.name}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              {formatCurrency(variant.price)} · {variant.type === 'PREORDER' ? 'Pre Order' : `Stok: ${variant.stock}`}
                            </p>
                          </div>
                          {selectedVariantId === variant.id && (
                            <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => { const n = Math.max(1, quantity - 1); setQuantity(n); setQuantityDisplay(String(n)); }}
                      className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={quantityDisplay}
                      onChange={(e) => { const raw = e.target.value.replace(/\D/g, ''); const num = parseInt(raw) || 0; setQuantityDisplay(raw ? String(num) : ''); setQuantity(num); }}
                      className="w-12 h-9 text-center text-sm font-bold text-gray-900 border-x border-gray-200 focus:outline-none bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => { const n = quantity + 1; setQuantity(n); setQuantityDisplay(String(n)); }}
                      className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Button
                    type="button"
                    onClick={addItem}
                    disabled={!selectedVariantId || quantity <= 0}
                    className="flex-1 h-9 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-lg text-sm font-semibold gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* 3b. TAMBAH PAKET */}
          {canManageProducts && combos.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Tambah Paket</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {combos.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPicker({ combo: c })}
                    disabled={loading}
                    className="min-h-[40px] rounded-lg border-2 border-gray-100 bg-gray-50/60 px-3 py-1.5 text-left text-xs hover:border-amber-300 transition-colors disabled:opacity-50"
                  >
                    <span className="font-semibold text-gray-800">{c.name}</span>
                    <span className="ml-1.5 text-gray-500">{formatCurrency(c.price)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 4. PEMBAYARAN */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Pembayaran</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500 font-medium">Metode</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={loading}>
                  <SelectTrigger className="h-9 text-xs text-left border-gray-200 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">💵 Cash</SelectItem>
                    <SelectItem value="CARD">💳 Kartu</SelectItem>
                    <SelectItem value="TRANSFER">🏦 Transfer Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500 font-medium">Status</Label>
                <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)} disabled={loading}>
                  <SelectTrigger className="h-9 text-xs text-left border-gray-200 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">⏳ Pending</SelectItem>
                    <SelectItem value="PAID">✅ Lunas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500 font-medium">Diskon</Label>
                <Input type="text" inputMode="numeric" value={discountDisplay}
                  onChange={(e) => { const raw = e.target.value.replace(/\D/g, ''); const num = parseInt(raw) || 0; setDiscountDisplay(raw ? num.toLocaleString('en-US') : ''); setDiscount(num); }}
                  placeholder="0" disabled={loading} className="h-9 text-sm border-gray-200 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500 font-medium">Pajak</Label>
                <Input type="text" inputMode="numeric" value={taxDisplay}
                  onChange={(e) => { const raw = e.target.value.replace(/\D/g, ''); const num = parseInt(raw) || 0; setTaxDisplay(raw ? num.toLocaleString('en-US') : ''); setTax(num); }}
                  placeholder="0" disabled={loading} className="h-9 text-sm border-gray-200 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500 font-medium">Ongkir</Label>
                <Input type="text" inputMode="numeric" value={ongkirDisplay}
                  onChange={(e) => { const raw = e.target.value.replace(/\D/g, ''); const num = parseInt(raw) || 0; setOngkirDisplay(raw ? num.toLocaleString('en-US') : ''); setOngkir(num); }}
                  placeholder="0" disabled={loading} className="h-9 text-sm border-gray-200 rounded-lg" />
              </div>
            </div>
          </section>

          {/* 5. CATATAN */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Catatan</span>
              </div>
              <span className="text-[10px] text-gray-300 font-medium">{notes.length}/50</span>
            </div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Tambahkan catatan opsional..." rows={2} maxLength={50} disabled={loading}
              className="text-sm resize-none border-gray-200 rounded-xl" />
          </section>

          {/* 6. POIN INFO (read-only) */}
          {pointsRedeemed > 0 && (
            <section className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50/60 p-4 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
                  <Gift className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-violet-900">Poin Ditukar</p>
                  <p className="text-xs text-violet-400">Tidak dapat diubah</p>
                </div>
              </div>
              <div className="bg-white rounded-lg px-3 py-2 border border-violet-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-violet-600 font-semibold">Jumlah Poin</span>
                  <span className="text-sm font-bold text-violet-900">{pointsRedeemed} poin</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-violet-600 font-semibold">Potongan</span>
                  <span className="text-sm font-bold text-violet-900">−{formatCurrency(pointDiscount)}</span>
                </div>
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ Penukaran poin tidak dapat diubah pada edit penjualan.
              </p>
            </section>
          )}

          {/* 7. RINGKASAN */}
          {(items.length > 0 || packages.length > 0) && (
            <section className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Ringkasan</span>
              </div>
              <div className="px-4 py-3.5 space-y-2.5">
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-700 tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                {packagesDiscount > 0 && (
                  <div className="flex justify-between items-center text-sm text-emerald-600">
                    <span>Diskon Paket</span>
                    <span className="font-semibold tabular-nums">−{formatCurrency(packagesDiscount)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between items-center text-sm text-emerald-600">
                    <span>Diskon</span>
                    <span className="font-semibold tabular-nums">−{formatCurrency(discount)}</span>
                  </div>
                )}
                {pointsRedeemed > 0 && (
                  <div className="flex justify-between items-center text-sm text-violet-600">
                    <span>Poin ({pointsRedeemed} pts)</span>
                    <span className="font-semibold tabular-nums">−{formatCurrency(pointDiscount)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>Pajak</span>
                    <span className="font-semibold tabular-nums">+{formatCurrency(tax)}</span>
                  </div>
                )}
                {ongkir > 0 && (
                  <div className="flex justify-between items-center text-sm text-orange-500">
                    <span>Ongkir</span>
                    <span className="font-semibold tabular-nums">+{formatCurrency(ongkir)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t border-gray-200 text-gray-900">
                  <span className="font-bold text-base">Total</span>
                  <span className="text-2xl font-bold tabular-nums">{formatCurrency(Math.max(0, total))}</span>
                </div>
              </div>
            </section>
          )}

        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-4 border-t bg-white shrink-0 gap-2.5 flex-row">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}
            className="flex-1 sm:flex-none h-10 border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-medium">
            Batal
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading || (items.length === 0 && packages.length === 0)}
            className="flex-1 h-10 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold gap-2 transition-colors">
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Menyimpan...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Simpan Perubahan
              </>
            )}
          </Button>
        </DialogFooter>

        {picker && (
          <ComboPickerDialog
            key={`${picker.combo.id}-${picker.editKey ?? 'new'}`}
            combo={picker.combo}
            initialSelections={picker.initial}
            submitLabel={picker.editKey ? 'Terapkan Perubahan' : 'Tambah ke Transaksi'}
            onClose={() => setPicker(null)}
            remaining={(variantId) => remainingForCombo(variantId, picker.editKey)}
            onAdd={(line) => {
              const next: EditPackage = {
                key: picker.editKey ?? line.key,
                saleComboId: picker.editKey ? packages.find((p) => p.key === picker.editKey)?.saleComboId : undefined,
                comboId: line.comboId,
                name: line.name,
                keep: false,
                selections: line.selections,
                lines: line.lines.map((l) => ({ variantId: l.variantId, productName: l.productName, variantName: l.variantName, price: l.price })),
                itemsTotal: line.itemsTotal,
                discount: line.discount,
              };
              setPackages((prev) => (picker.editKey ? prev.map((p) => (p.key === picker.editKey ? next : p)) : [...prev, next]));
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}