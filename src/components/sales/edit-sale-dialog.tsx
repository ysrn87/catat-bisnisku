'use client';

import { useState, useEffect } from 'react';
import { PaymentStatus } from '@prisma/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { updateSaleAction } from '@/actions/sales';
import {
  Trash2, Gift, Plus, Minus, Search, X, Package,
  ShoppingCart, CreditCard, FileText, Pencil, Check,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface EditSaleDialogProps {
  sale: {
    id: string;
    saleNumber?: string;
    customerId: string | null;
    paymentMethod: string;
    paymentStatus?: string;
    discount: number;
    tax: number;
    ongkir: number;
    notes: string | null;
    pointsRedeemed?: number;
    customer?: { name: string } | null;
    nonMemberCustomer?: { name: string } | null;
    items: Array<{
      id: string;
      quantity: number;
      price: number;
      variant: {
        id: string;
        name: string;
        stock: number;
        product: { name: string };
      };
    }>;
  };
  variants?: Array<{
    id: string;
    name: string;
    price: number;
    stock: number;
    points: number;
    product: { name: string };
  }>;
  conversionRate?: number;
  userRole?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface SaleItem {
  variantId: string;
  variantName: string;
  productName: string;
  quantity: number;
  price: number;
  currentStock: number;
  priceDisplay?: string;
}

export function EditSaleDialog({
  sale,
  variants = [],
  conversionRate = 1000,
  userRole,
  open,
  onOpenChange,
  onSuccess,
}: EditSaleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>(sale.paymentMethod);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    (sale.paymentStatus as PaymentStatus) || PaymentStatus.PAID,
  );
  const [discount, setDiscount] = useState<number>(sale.discount);
  const [discountDisplay, setDiscountDisplay] = useState(
    sale.discount > 0 ? sale.discount.toLocaleString('en-US') : '',
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

  const canManageProducts = userRole === 'ADMINISTRATOR' || userRole === 'MANAGER';
  const pointsRedeemed = sale.pointsRedeemed || 0;
  const pointDiscount = pointsRedeemed * conversionRate;
  const customerName = sale.customer?.name ?? sale.nonMemberCustomer?.name ?? 'Pelanggan Umum';

  useEffect(() => {
    setItems(
      sale.items.map((item) => ({
        variantId: item.variant.id,
        variantName: item.variant.name,
        productName: item.variant.product.name,
        quantity: item.quantity,
        price: item.price,
        currentStock: item.variant.stock + item.quantity,
        priceDisplay: item.price.toLocaleString('en-US'),
      })),
    );
  }, [sale]);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal - discount - pointDiscount + tax + ongkir;

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    const newItems = [...items];
    if (newQty <= newItems[index].currentStock) {
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
    .filter((v) => v.stock > 0)
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
    if (quantity > variant.stock) {
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
    if (items.length === 0) {
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
                <p className="text-xs text-gray-400">{sale.customerId ? 'Member' : 'Non-Member'}</p>
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
              {items.length > 0 && (
                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
                  {items.length} item · {items.reduce((s, i) => s + i.quantity, 0)} pcs
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl py-7 flex flex-col items-center gap-1.5 bg-gray-50/40">
                <ShoppingCart className="w-6 h-6 text-gray-300" />
                <p className="text-sm font-medium text-gray-400">Keranjang kosong</p>
              </div>
            ) : (
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
                          disabled={loading || items.length === 1}
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
                            disabled={loading || item.quantity >= item.currentStock}
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
                        Stok: {item.currentStock} pcs
                      </p>

                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 3. TAMBAH PRODUK (admin/manager only) */}
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
                      </p>
                      {selectedVariant.name !== selectedVariant.product.name && (
                        <p className="text-xs text-amber-600 font-medium leading-tight">
                          {selectedVariant.name}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatCurrency(selectedVariant.price)} · Stok: {selectedVariant.stock}
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
                            </p>
                            {variant.name !== variant.product.name && (
                              <p className="text-xs text-amber-600 font-medium leading-tight">
                                {variant.name}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              {formatCurrency(variant.price)} · Stok: {variant.stock}
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
                    <SelectItem value="UNPAID">❌ Belum Bayar</SelectItem>
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
          {items.length > 0 && (
            <section className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Ringkasan</span>
              </div>
              <div className="px-4 py-3.5 space-y-2.5">
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-700 tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
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
          <Button type="button" onClick={handleSubmit} disabled={loading || items.length === 0}
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
      </DialogContent>
    </Dialog>
  );
}