'use client';

import { useState, useCallback } from 'react';
import { PaymentStatus } from '@prisma/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { createSaleAction } from '@/actions/sales';
import { Plus, Trash2, Gift, X, User, Search, ChevronDown, UserPlus, ShoppingCart, CreditCard, Package, FileText, Minus, Loader2, ScanLine, CameraOff } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { QuickAddCustomerForm } from '@/components/customers/quick-add-customer-form';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

interface SaleItem {
  variantId: string;
  variantName: string;
  quantity: number;
  price: number;
}

interface NewSaleDialogProps {
  variants: Array<{
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
  }>;
  customers: Array<{
    id: string;
    name: string;
    points: number;
  }>;
  walkInCustomers?: Array<{
    id: string;
    name: string;
    phone: string;
  }>;
  conversionRate?: number;
  trigger?: React.ReactNode;
}

export function NewSaleDialog({ variants, customers, walkInCustomers = [], conversionRate = 1000, trigger }: NewSaleDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [customerId, setCustomerId] = useState<string>('');
  const [walkInCustomerId, setWalkInCustomerId] = useState<string>('');
  const [customerType, setCustomerType] = useState<'member' | 'walk-in' | 'customer' | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.PAID);
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [ongkir, setOngkir] = useState<number>(0);
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [showQuickAddForm, setShowQuickAddForm] = useState(false);
  const [localWalkInCustomers, setLocalWalkInCustomers] = useState(walkInCustomers);

  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  const [quantityDisplay, setQuantityDisplay] = useState('1');
  const [discountDisplay, setDiscountDisplay] = useState('');
  const [taxDisplay, setTaxDisplay] = useState('');
  const [ongkirDisplay, setOngkirDisplay] = useState('');

  // ── Barcode scanner ──────────────────────────────────────────────────────────
  const [showScanner, setShowScanner] = useState(false);

  const handleBarcodeDetected = useCallback((barcodeValue: string) => {
    const matched = variants.find(
      (v) => v.barcode && v.barcode === barcodeValue
    );

    if (matched) {
      // Check stock (same guard as addItem)
      if (matched.type !== 'PREORDER' && matched.stock <= 0) {
        toast({
          title: 'Stok Habis',
          description: `${matched.name} sudah habis.`,
          variant: 'destructive',
        });
      } else {
        setSelectedVariantId(matched.id);
        setShowScanner(false);
        toast({
          title: 'Produk Ditemukan ✓',
          description: `${matched.name} — ${matched.product.name}`,
        });
      }
    } else {
      toast({
        title: 'Produk Tidak Ditemukan',
        description: `Barcode "${barcodeValue}" belum terdaftar di sistem.`,
        variant: 'destructive',
      });
      // Keep scanner open so kasir can try again
    }
  }, [variants]); // eslint-disable-line react-hooks/exhaustive-deps

  const { isScanning, isLoading: scannerLoading, error: scannerError, videoRef, startScan, stopScan } =
    useBarcodeScanner(handleBarcodeDetected);

  const toggleScanner = () => {
    if (showScanner) {
      stopScan();
      setShowScanner(false);
    } else {
      setShowScanner(true);
      // startScan is called via useEffect inside the scanner view to ensure video element is mounted
    }
  };
  // ────────────────────────────────────────────────────────────────────────────

  const { toast } = useToast();

  const selectedCustomer = customers.find(c => c.id === customerId);
  const selectedWalkInCustomer = localWalkInCustomers.find(c => c.id === walkInCustomerId);
  const availablePoints = selectedCustomer?.points || 0;
  const pointDiscount = pointsToRedeem * conversionRate;

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal - discount - pointDiscount + tax + ongkir;

  const pointsEarned = (customerId && customerType === 'member' && pointsToRedeem === 0)
    ? items.reduce((sum, item) => {
        const variant = variants.find(v => v.id === item.variantId);
        return sum + (variant?.pointsPerUnit ?? 0) * item.quantity;
      }, 0)
    : 0;

  const handleCustomerChange = (value: string) => {
    setCustomerId('');
    setWalkInCustomerId('');
    setPointsToRedeem(0);
    setIsCustomerDropdownOpen(false);
    setCustomerSearch('');

    if (value === 'CUSTOMER') {
      setCustomerType('customer');
    } else {
      const isMember = customers.some(c => c.id === value);
      const isWalkIn = localWalkInCustomers.some(c => c.id === value);

      if (isMember) {
        setCustomerId(value);
        setCustomerType('member');
      } else if (isWalkIn) {
        setWalkInCustomerId(value);
        setCustomerType('walk-in');
      }
    }
  };

  const handleQuickAddSuccess = (customer: { id: string; name: string; phone: string }) => {
    setLocalWalkInCustomers(prev => [customer, ...prev]);
    setWalkInCustomerId(customer.id);
    setCustomerType('walk-in');
    setShowQuickAddForm(false);
    setIsCustomerDropdownOpen(false);
    toast({ title: 'Berhasil!', description: 'Pelanggan ditambahkan dan dipilih.' });
  };

  const handleDiscountChange = (value: number) => {
    const totalDiscount = value + pointDiscount;
    if (value > subtotal) {
      toast({ title: 'Diskon Tidak Valid', description: 'Diskon tidak boleh melebihi subtotal.', variant: 'destructive' });
      setDiscount(subtotal - pointDiscount);
    } else if (totalDiscount > subtotal) {
      toast({ title: 'Total Diskon Terlalu Tinggi', description: `Kombinasi diskon dan poin (${formatCurrency(totalDiscount)}) melebihi subtotal (${formatCurrency(subtotal)}).`, variant: 'destructive' });
      setDiscount(Math.max(0, subtotal - pointDiscount));
    } else {
      setDiscount(value);
    }
  };

  const handlePointsRedeemChange = (value: number) => {
    const newPointDiscount = value * conversionRate;
    const totalDiscount = discount + newPointDiscount;
    if (value > availablePoints) {
      toast({ title: 'Poin Tidak Cukup', description: `Pelanggan hanya memiliki ${availablePoints} poin.`, variant: 'destructive' });
      setPointsToRedeem(availablePoints);
    } else if (value < 0) {
      setPointsToRedeem(0);
    } else if (totalDiscount > subtotal) {
      const maxPoints = Math.floor((subtotal - discount) / conversionRate);
      toast({ title: 'Total Diskon Terlalu Tinggi', description: `Maksimal ${maxPoints} poin dapat ditukar.`, variant: 'destructive' });
      setPointsToRedeem(Math.max(0, maxPoints));
    } else {
      setPointsToRedeem(value);
    }
  };

  const handleProductSelect = (variantId: string) => {
    setSelectedVariantId(variantId);
    setIsProductDropdownOpen(false);
    setProductSearch('');
  };

  const addItem = () => {
    if (!selectedVariantId || quantity <= 0) {
      toast({ title: 'Error', description: 'Pilih produk dan masukkan jumlah.', variant: 'destructive' });
      return;
    }
    const variant = variants.find(v => v.id === selectedVariantId);
    if (!variant) return;
    if (variant.type !== 'PREORDER' && quantity > variant.stock) {
      toast({ title: 'Error', description: `Stok tersedia hanya ${variant.stock} unit.`, variant: 'destructive' });
      return;
    }
    const existingItemIndex = items.findIndex(item => item.variantId === selectedVariantId);
    if (existingItemIndex >= 0) {
      const newItems = [...items];
      newItems[existingItemIndex].quantity += quantity;
      setItems(newItems);
    } else {
      setItems([...items, {
        variantId: variant.id,
        variantName: `${variant.name}`,
        quantity,
        price: variant.price,
      }]);
    }
    setSelectedVariantId('');
    setQuantity(1);
    setQuantityDisplay('1');
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    const variant = variants.find(v => v.id === items[index].variantId);
    if (!variant) return;
    if (variant.type === 'PREORDER' || newQty <= variant.stock) {
      const newItems = [...items];
      newItems[index].quantity = newQty;
      setItems(newItems);
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!customerId && !walkInCustomerId && customerType !== 'customer') {
      toast({ title: 'Error', description: 'Pilih pelanggan terlebih dahulu.', variant: 'destructive' });
      return;
    }
    if (items.length === 0) {
      toast({ title: 'Error', description: 'Tambahkan minimal satu produk.', variant: 'destructive' });
      return;
    }
    if (discount > subtotal) {
      toast({ title: 'Error', description: 'Diskon tidak boleh melebihi subtotal.', variant: 'destructive' });
      return;
    }
    if (pointsToRedeem > 0 && !customerId) {
      toast({ title: 'Error', description: 'Penukaran poin hanya untuk member.', variant: 'destructive' });
      return;
    }
    if (pointsToRedeem > availablePoints) {
      toast({ title: 'Error', description: 'Poin yang ditukar melebihi poin tersedia.', variant: 'destructive' });
      return;
    }
    const totalDiscount = discount + pointDiscount;
    if (totalDiscount > subtotal) {
      toast({ title: 'Error', description: `Total diskon (${formatCurrency(totalDiscount)}) melebihi subtotal (${formatCurrency(subtotal)}).`, variant: 'destructive' });
      return;
    }
    if (total < 0) {
      toast({ title: 'Error', description: 'Total tidak boleh negatif. Kurangi diskon.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const result = await createSaleAction({
        items: items.map(item => ({ variantId: item.variantId, quantity: item.quantity, price: item.price })),
        customerId: customerType === 'walk-in' ? walkInCustomerId || null : null,
        memberId:   customerType === 'member'  ? customerId       || null : null,
        paymentMethod,
        paymentStatus,
        discount,
        tax,
        ongkir,
        notes,
        pointsRedeemed: customerType === 'member' ? pointsToRedeem : 0,
      });

      if (result.success) {
        toast({ title: 'Transaksi Berhasil! 🎉', description: `Total: ${formatCurrency(total)}` });
        setItems([]);
        setCustomerId('');
        setWalkInCustomerId('');
        setCustomerType('');
        setDiscount(0);
        setTax(0);
        setOngkir(0);
        setPaymentMethod('CASH');
        setPaymentStatus('PAID');
        setPointsToRedeem(0);
        setNotes('');
        setSelectedVariantId('');
        setQuantity(1);
        setQuantityDisplay('1');
        setDiscountDisplay('');
        setTaxDisplay('');
        setOngkirDisplay('');
        setProductSearch('');
        setCustomerSearch('');
        setShowQuickAddForm(false);
        setShowScanner(false);
        setIsProductDropdownOpen(false);
        setIsCustomerDropdownOpen(false);
        setOpen(false);
      } else {
        toast({ title: 'Error', description: result.error || 'Gagal membuat transaksi.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan yang tidak terduga.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getCustomerDisplayName = () => {
    if (customerType === 'member' && selectedCustomer) return selectedCustomer.name;
    if (customerType === 'walk-in' && selectedWalkInCustomer) return selectedWalkInCustomer.name;
    if (customerType === 'customer') return 'Pelanggan Umum';
    return null;
  };

  const selectedVariant = variants.find(v => v.id === selectedVariantId);
  const customerSelected = !!(customerId || walkInCustomerId || customerType === 'customer');

  const filteredMembers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );
  const filteredWalkIns = localWalkInCustomers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );
  const filteredVariants = variants
    .filter(v => v.type === 'PREORDER' || v.stock > 0)
    .filter(v =>
      !productSearch ||
      v.product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      v.name.toLowerCase().includes(productSearch.toLowerCase())
    );

  const isWalkInVisible = !customerSearch || 'pelanggan umum'.includes(customerSearch.toLowerCase()) || 'umum'.includes(customerSearch.toLowerCase());

  return (
    <Dialog open={open} onOpenChange={(val) => {
      // Stop scanner when dialog closes
      if (!val) {
        stopScan();
        setShowScanner(false);
      }
      setOpen(val);
    }}>
      {trigger && <div onClick={() => setOpen(true)}>{trigger}</div>}
    <DialogTrigger asChild>
        {!trigger && (
          <Button className="gap-2 bg-[#028697] hover:bg-[#017585] shadow-sm">
            <Plus className="w-4 h-4" />
            Penjualan Baru
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        aria-describedby={undefined}
        className="w-[95vw] max-w-[95vw] sm:max-w-[680px] min-h-[80vh] max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0 border-0 shadow-2xl"
      >
        {/* ── Header ── */}
        <div className="relative bg-gradient-to-br from-[#028697] to-[#015561] px-6 pt-5 pb-7 shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-8 w-16 h-16 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <DialogHeader className="space-y-0.5 text-left p-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">Penjualan Baru</DialogTitle>
              <p className="text-white/65 text-xs font-normal">Isi detail transaksi di bawah ini</p>
            </DialogHeader>
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* ─── 1. PELANGGAN ─── */}
          <section className="space-y-2">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Pelanggan</span>
            </div>

            {showQuickAddForm && (
              <div className="p-3 border border-[#028697]/20 rounded-xl bg-[#028697]/[0.04]">
                <QuickAddCustomerForm
                  onSuccess={handleQuickAddSuccess}
                  onCancel={() => setShowQuickAddForm(false)}
                />
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsCustomerDropdownOpen(!isCustomerDropdownOpen);
                  setShowQuickAddForm(false);
                }}
                className={`flex items-center gap-2 w-full min-h-[46px] px-3 py-2 border rounded-xl text-left transition-all text-sm ${
                  customerSelected
                    ? customerType === 'customer'
                      ? 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                      : 'border-[#028697]/30 bg-[#028697]/[0.06] hover:bg-[#028697]/[0.09]'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {customerSelected ? (
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${
                      customerType === 'customer' ? 'bg-gray-400' : 'bg-[#028697]'
                    }`}>
                      {customerType === 'customer' ? (
                        <User className="w-4 h-4" />
                      ) : (
                        getCustomerDisplayName()?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{getCustomerDisplayName()}</p>
                      <p className={`text-xs ${customerType === 'customer' ? 'text-gray-400' : 'text-[#028697]'}`}>
                        {customerType === 'member'
                          ? `Member · ${selectedCustomer?.points ?? 0} poin`
                          : customerType === 'walk-in'
                          ? 'Non-Member'
                          : 'Tanpa akun · tidak dapat poin'}
                      </p>
                    </div>
                    <X
                      className="w-4 h-4 text-gray-400 hover:text-red-500 shrink-0 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomerId('');
                        setWalkInCustomerId('');
                        setCustomerType('');
                        setPointsToRedeem(0);
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <Search className="w-4 h-4 text-gray-300 shrink-0" />
                    <span className="text-gray-400 flex-1 text-sm">Cari atau pilih pelanggan...</span>
                    <ChevronDown className="w-4 h-4 text-gray-300 shrink-0" />
                  </>
                )}
              </button>

              {isCustomerDropdownOpen && (
                <div className="absolute z-50 w-full mt-1.5 border border-gray-200 rounded-xl bg-white shadow-2xl max-h-[360px] overflow-hidden flex flex-col">
                  <div className="p-2.5 border-b space-y-2 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Cari nama pelanggan..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="pl-8 h-9 text-sm border-gray-200 rounded-lg focus-visible:ring-[#028697]/30 focus-visible:border-[#028697]"
                        autoFocus
                      />
                    </div>
                    {!showQuickAddForm && (
                      <button
                        type="button"
                        onClick={() => { setShowQuickAddForm(true); setIsCustomerDropdownOpen(false); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold text-[#028697] bg-[#028697]/[0.06] hover:bg-[#028697]/[0.1] rounded-lg transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        + Tambah Pelanggan Baru
                      </button>
                    )}
                  </div>

                  <div className="overflow-y-auto flex-1">
                    {/* ── Pelanggan Umum (Customer) ── */}
                    {isWalkInVisible && (
                      <>
                        <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest sticky top-0 border-b">
                          Umum
                        </div>
                        <div
                          onClick={() => handleCustomerChange('CUSTOMER')}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 ${customerType === 'customer' ? 'bg-gray-100' : ''}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">Pelanggan Umum</p>
                            <p className="text-xs text-gray-400">Tanpa akun · tidak dapat poin</p>
                          </div>
                          {customerType === 'customer' && (
                            <div className="w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center shrink-0">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {filteredMembers.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest sticky top-0 border-b">
                          Members ({filteredMembers.length})
                        </div>
                        {filteredMembers.map((customer) => (
                          <div
                            key={customer.id}
                            onClick={() => handleCustomerChange(customer.id)}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 ${customerId === customer.id ? 'bg-[#028697]/[0.06]' : ''}`}
                          >
                            <div className="w-8 h-8 rounded-full bg-[#028697]/10 flex items-center justify-center shrink-0 text-[#028697] text-xs font-bold">
                              {customer.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{customer.name}</p>
                              <p className="text-xs text-gray-400">{customer.points} poin</p>
                            </div>
                            {customerId === customer.id && (
                              <div className="w-5 h-5 rounded-full bg-[#028697] flex items-center justify-center shrink-0">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}

                    {filteredWalkIns.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-gray-50 text-gray-400 text-[10px] font-bold uppercase tracking-widest sticky top-0 border-b">
                          Customers ({filteredWalkIns.length})
                        </div>
                        {filteredWalkIns.map((customer) => (
                          <div
                            key={customer.id}
                            onClick={() => handleCustomerChange(customer.id)}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 ${walkInCustomerId === customer.id ? 'bg-[#028697]/[0.06]' : ''}`}
                          >
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-600 text-xs font-bold">
                              {customer.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{customer.name}</p>
                              <p className="text-xs text-gray-400">{customer.phone}</p>
                            </div>
                            {walkInCustomerId === customer.id && (
                              <div className="w-5 h-5 rounded-full bg-[#028697] flex items-center justify-center shrink-0">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}

                    {customerSearch && filteredMembers.length === 0 && filteredWalkIns.length === 0 && !isWalkInVisible && (
                      <div className="p-6 text-center text-sm text-gray-400">Pelanggan tidak ditemukan</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {customerSelected && (
            <>
              {/* ─── 2. KERANJANG ─── */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Keranjang</span>
                  </div>
                  {items.length > 0 && (
                    <span className="text-[11px] font-bold text-[#028697] bg-[#028697]/[0.08] px-2.5 py-0.5 rounded-full border border-blue-100">
                      {items.length} item · {items.reduce((sum, item) => sum + item.quantity, 0)} pcs
                    </span>
                  )}
                </div>

                {items.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl py-7 flex flex-col items-center gap-1.5 bg-gray-50/40">
                    <ShoppingCart className="w-6 h-6 text-gray-300" />
                    <p className="text-sm font-medium text-gray-400">Keranjang masih kosong</p>
                    <p className="text-xs text-gray-300">Tambahkan produk di bawah ini</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Produk</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</span>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                      {items.map((item, index) => {
                        const variant = variants.find(v => v.id === item.variantId);
                        const itemPoints = (variant?.pointsPerUnit ?? 0) * item.quantity;
                        return (
                          <div key={index} className="px-3 py-3 hover:bg-gray-50/60 transition-colors space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900 leading-snug break-words flex-1">
                                {variant?.name}
                              </p>
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                disabled={loading}
                                className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-30"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-xs text-[#028697] leading-snug break-words">
                              {variant?.product.name}
                            </p>
                            <div className="pt-0.5 flex items-center gap-2 flex-wrap">
                              <p className="text-xs text-gray-400">{formatCurrency(item.price)}/pcs</p>
                              {variant?.type === 'PREORDER' && (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">Pre-Order</span>
                              )}
                              {customerId && pointsToRedeem === 0 && itemPoints > 0 && (
                                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                  +{itemPoints} poin
                                </span>
                              )}
                            </div>
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
                                  disabled={loading || (variant?.type !== 'PREORDER' && item.quantity >= (variant?.stock || 0))}
                                  className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <span className="text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap">
                                {formatCurrency(item.price * item.quantity)}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-300 pt-0.5">
                              {variant?.type === 'PREORDER' ? 'Pre Order' : `Stok: ${variant?.stock || 0} pcs`}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* ─── 3. TAMBAH PRODUK ─── */}
              <section className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Tambah Produk</span>
                </div>

                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/40 space-y-2.5">
                  {/* Selected product preview */}
                  {selectedVariant && (
                    <div className="flex items-center gap-2.5 p-2.5 bg-white border border-[#028697]/25 rounded-lg shadow-sm">
                      <div className="w-8 h-8 rounded-lg bg-[#028697]/10 border border-[#028697]/15 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-[#028697]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {selectedVariant.name} — {selectedVariant.product.name}
                          {selectedVariant.type === 'PREORDER' && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Pre-Order</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatCurrency(selectedVariant.price)} · {selectedVariant.type === 'PREORDER' ? 'Pre Order' : `Stok: ${selectedVariant.stock}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedVariantId('')}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Search + Scan button row */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Cari nama produk..."
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setIsProductDropdownOpen(true);
                        }}
                        onFocus={() => setIsProductDropdownOpen(true)}
                        className="pl-8 h-9 text-sm border-gray-200 rounded-lg bg-white focus-visible:ring-[#028697]/30 focus-visible:border-[#028697]"
                      />
                    </div>

                    {/* Scan button */}
                    <button
                      type="button"
                      onClick={toggleScanner}
                      title={showScanner ? 'Tutup scanner' : 'Scan barcode'}
                      className={`h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border transition-all ${
                        showScanner
                          ? 'bg-[#028697] border-[#028697] text-white'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-[#028697] hover:text-[#028697]'
                      }`}
                    >
                      {showScanner ? (
                        <CameraOff className="w-4 h-4" />
                      ) : (
                        <ScanLine className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* ── Barcode Scanner view ── */}
                  {showScanner && (
                    <div className="rounded-xl overflow-hidden border border-[#028697]/20 bg-black space-y-0">
                      {/* Video */}
                      <div className="relative w-full aspect-[4/3]">
                        <video
                          ref={(el) => {
                            (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
                            if (el && !isScanning && !scannerLoading && showScanner) {
                              startScan();
                            }
                          }}
                          className="w-full h-full object-cover"
                          playsInline
                          muted
                        />

                        {/* Scanning overlay */}
                        {isScanning && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            {/* Dimmed corners */}
                            <div className="absolute inset-0 bg-black/30" />
                            {/* Scan frame */}
                            <div className="relative w-52 h-32">
                              {/* Corner brackets */}
                              <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl" />
                              <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr" />
                              <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl" />
                              <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white rounded-br" />
                              {/* Animated scan line */}
                              <div className="absolute inset-x-1 top-0 h-0.5 bg-[#028697] animate-scan-line" />
                            </div>
                          </div>
                        )}

                        {/* Loading state */}
                        {scannerLoading && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-2">
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                            <p className="text-white text-xs">Memulai kamera...</p>
                          </div>
                        )}
                      </div>

                      {/* Scanner status bar */}
                      <div className="px-3 py-2 bg-gray-900 flex items-center justify-between">
                        {scannerError ? (
                          <p className="text-xs text-red-400 flex-1">{scannerError}</p>
                        ) : isScanning ? (
                          <p className="text-xs text-white/70 flex-1">Arahkan kamera ke barcode produk</p>
                        ) : scannerLoading ? (
                          <p className="text-xs text-white/50 flex-1">Memulai kamera...</p>
                        ) : (
                          <p className="text-xs text-white/50 flex-1">Siap scan</p>
                        )}
                        <button
                          type="button"
                          onClick={() => { stopScan(); setShowScanner(false); }}
                          className="text-xs text-white/50 hover:text-white transition-colors ml-3 shrink-0"
                        >
                          Tutup
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tailwind scan-line animation — injected inline so no config change needed */}
                  <style>{`
                    @keyframes scan-line {
                      0%   { top: 0; }
                      50%  { top: calc(100% - 2px); }
                      100% { top: 0; }
                    }
                    .animate-scan-line {
                      animation: scan-line 2s ease-in-out infinite;
                    }
                  `}</style>

                  {/* Product dropdown */}
                  {isProductDropdownOpen && productSearch && (
                    <div className="border border-gray-200 rounded-lg bg-white shadow-md max-h-[180px] overflow-y-auto">
                      {filteredVariants.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-400">Produk tidak ditemukan</div>
                      ) : (
                        filteredVariants.map((variant) => (
                          <div
                            key={variant.id}
                            onClick={() => handleProductSelect(variant.id)}
                            className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 ${selectedVariantId === variant.id ? 'bg-[#028697]/[0.06]' : ''}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate">
                                {variant.name} — {variant.product.name}
                                {variant.type === 'PREORDER' && (
                                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Pre-Order</span>
                                )}
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatCurrency(variant.price)} · {variant.type === 'PREORDER' ? 'Pre Order' : `Stok: ${variant.stock}`}
                              </p>
                            </div>
                            {selectedVariantId === variant.id && (
                              <div className="w-5 h-5 rounded-full bg-[#028697] flex items-center justify-center shrink-0">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Qty stepper + Add button */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.max(1, quantity - 1);
                          setQuantity(next);
                          setQuantityDisplay(String(next));
                        }}
                        className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quantityDisplay}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '');
                          const num = parseInt(raw) || 0;
                          setQuantityDisplay(raw ? String(num) : '');
                          setQuantity(num);
                        }}
                        className="w-12 h-9 text-center text-sm font-bold text-gray-900 border-x border-gray-200 focus:outline-none bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = quantity + 1;
                          setQuantity(next);
                          setQuantityDisplay(String(next));
                        }}
                        className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <Button
                      type="button"
                      onClick={addItem}
                      disabled={!selectedVariantId || quantity <= 0}
                      className="flex-1 h-9 bg-[#028697] hover:bg-[#017585] disabled:opacity-40 text-white rounded-lg text-sm font-semibold gap-1.5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah
                    </Button>
                  </div>
                </div>
              </section>

              {/* ─── 4. PEMBAYARAN ─── */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Pembayaran</span>
                  <div className="flex-1 border-t border-gray-100" />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500 font-medium">Metode</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-9 text-xs text-left border-gray-200 rounded-lg focus:ring-[#028697]/30 focus:border-[#028697]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">💵 Cash</SelectItem>
                        <SelectItem value="CARD">💳 Kartu</SelectItem>
                        <SelectItem value="TRANSFER">🏦 Transfer Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500 font-medium">Status</Label>
                    <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
                      <SelectTrigger className="h-9 text-xs text-left border-gray-200 rounded-lg focus:ring-[#028697]/30 focus:border-[#028697]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PAID">✅ Lunas</SelectItem>
                        <SelectItem value="PENDING">⏳ Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500 font-medium">Diskon</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={discountDisplay}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        const num = parseInt(raw) || 0;
                        setDiscountDisplay(raw ? num.toLocaleString('en-US') : '');
                        handleDiscountChange(num);
                      }}
                      placeholder="0"
                      className="h-9 text-sm border-gray-200 rounded-lg focus-visible:ring-[#028697]/30 focus-visible:border-[#028697]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500 font-medium">Pajak</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={taxDisplay}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        const num = parseInt(raw) || 0;
                        setTaxDisplay(raw ? num.toLocaleString('en-US') : '');
                        setTax(num);
                      }}
                      placeholder="0"
                      className="h-9 text-sm border-gray-200 rounded-lg focus-visible:ring-[#028697]/30 focus-visible:border-[#028697]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500 font-medium">Ongkir</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={ongkirDisplay}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        const num = parseInt(raw) || 0;
                        setOngkirDisplay(raw ? num.toLocaleString('en-US') : '');
                        setOngkir(num);
                      }}
                      placeholder="0"
                      className="h-9 text-sm border-gray-200 rounded-lg focus-visible:ring-[#028697]/30 focus-visible:border-[#028697]"
                    />
                  </div>
                </div>
              </section>

              {/* ─── 5. CATATAN ─── */}
              <section className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Catatan</span>
                  </div>
                  <span className="text-[10px] text-gray-300 font-medium">{notes.length}/50</span>
                </div>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tambahkan catatan opsional..."
                  rows={2}
                  maxLength={50}
                  className="text-sm resize-none border-gray-200 rounded-xl focus-visible:ring-[#028697]/30 focus-visible:border-[#028697]"
                />
              </section>

              {/* ─── 6. TUKAR POIN (member only) ─── */}
              {customerType === 'member' && customerId && (
                <section className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
                        <Gift className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-violet-900">Tukar Poin</p>
                        <p className="text-xs text-violet-400">1 poin = {formatCurrency(conversionRate)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-violet-400 uppercase font-bold tracking-wider">Tersedia</p>
                      <p className="text-base font-bold text-violet-900">{availablePoints} <span className="text-xs font-medium">poin</span></p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-violet-600 font-semibold">Jumlah Poin (Maks: {availablePoints})</Label>
                    <Input
                      type="number"
                      min="0"
                      max={availablePoints}
                      value={pointsToRedeem}
                      onChange={(e) => handlePointsRedeemChange(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="bg-white border-violet-200 rounded-lg h-9 text-sm focus:border-violet-400"
                    />
                  </div>
                  {pointsToRedeem > 0 && (
                    <>
                      <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-violet-200 shadow-sm">
                        <span className="text-xs text-violet-600 font-semibold">Potongan Poin</span>
                        <span className="text-sm font-bold text-violet-900">−{formatCurrency(pointDiscount)}</span>
                      </div>
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        ⚠️ Member tidak mendapatkan poin saat menukarkan poin
                      </p>
                    </>
                  )}
                </section>
              )}

              {/* ─── 7. RINGKASAN ─── */}
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
                    {pointsToRedeem > 0 && (
                      <div className="flex justify-between items-center text-sm text-violet-600">
                        <span>Poin ({pointsToRedeem} pts)</span>
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
                    {(discount + pointDiscount) > subtotal * 0.8 && (discount + pointDiscount) <= subtotal && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                        ⚠️ Total diskon {Math.round((discount + pointDiscount) / subtotal * 100)}% dari subtotal
                      </div>
                    )}
                    {(discount + pointDiscount) > subtotal && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                        ❌ Total diskon melebihi subtotal! Kurangi diskon atau poin.
                      </div>
                    )}
                    <div className={`flex justify-between items-center pt-3 border-t border-gray-200 ${total < 0 ? 'text-red-600' : total === 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                      <span className="font-bold text-base">Total</span>
                      <span className="text-2xl font-bold tabular-nums">{formatCurrency(Math.max(0, total))}</span>
                    </div>
                    {customerType === 'member' && customerId && (
                      <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                        pointsToRedeem > 0
                          ? 'bg-amber-50 border border-amber-200'
                          : pointsEarned > 0
                            ? 'bg-emerald-50 border border-emerald-200'
                            : 'bg-gray-50 border border-gray-200'
                      }`}>
                        <span className={`font-semibold ${pointsToRedeem > 0 ? 'text-amber-700' : pointsEarned > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                          🎁 Poin Diperoleh
                        </span>
                        <span className={`font-bold ${pointsToRedeem > 0 ? 'text-amber-600' : pointsEarned > 0 ? 'text-emerald-800' : 'text-gray-400'}`}>
                          {pointsToRedeem > 0 ? '0 poin (penukaran aktif)' : `+${pointsEarned} poin`}
                        </span>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={loading}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              loading ||
              items.length === 0 ||
              (!customerId && !walkInCustomerId && customerType !== 'customer') ||
              (discount + pointDiscount) > subtotal ||
              total < 0
            }
            className="bg-[#028697] hover:bg-[#017585] disabled:opacity-50 text-white rounded-xl font-bold gap-2 transition-colors min-w-[160px] h-10"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Memproses...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Selesaikan Transaksi
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}