'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { createVariantAction, updateVariantAction } from '@/actions/products';
import { Plus, Pencil, Loader2, Tag, Layers, DollarSign, BarChart2, Star, AlertTriangle, ScanLine, CameraOff, Barcode, Package, Clock } from 'lucide-react';

interface VariantDialogProps {
  mode: 'create' | 'edit';
  productId?: string;
  productSku?: string;
  variantCount?: number;
  /** For create mode: pre-selects the type based on the product's default (from product.type) */
  defaultType?: 'READY_STOCK' | 'PREORDER';
  /** For edit mode: the current type of this specific variant */
  variantType?: 'READY_STOCK' | 'PREORDER';
  variant?: {
    id: string;
    name: string;
    sku: string;
    barcode?: string | null;
    price: number;
    cost: number;
    stock: number;
    lowStockAt: number;
    pointsPerUnit: number;
  };
  trigger?: React.ReactNode;
}

function FieldLabel({
  icon: Icon,
  label,
  required,
  hint,
}: {
  icon?: React.ElementType;
  label: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 text-gray-400" />}
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </span>
      </div>
      {hint && <span className="text-[11px] text-gray-300">{hint}</span>}
    </div>
  );
}

function CurrencyInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none select-none">
        Rp
      </span>
      <Input
        id={id}
        name={name}
        type="tel"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-9 h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300 tabular-nums"
      />
    </div>
  );
}

const toTitleCase = (val: string) => val.replace(/\b\w/g, (c) => c.toUpperCase());

function autoGenerateSku(productSku: string, variantCount: number): string {
  const index = variantCount + 1;
  return `${productSku}-${index.toString(16).toUpperCase().padStart(2, '0')}`;
}

// ── Inline barcode scanner component ────────────────────────────────────────
function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (value: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (readerRef.current) {
      try { readerRef.current.reset(); } catch { /* ignore */ }
      readerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    async function start() {
      try {
        const { BrowserMultiFormatReader, NotFoundException } = await import('@zxing/library');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;
        if (mountedRef.current) { setIsScanning(true); setIsLoading(false); }

        reader.decodeFromStream(stream, videoRef.current!, (result, err) => {
          if (!mountedRef.current) return;
          if (result) {
            onDetected(result.getText());
            return;
          }
          if (err && !(err instanceof NotFoundException)) {
            console.warn('Scan error:', err);
          }
        });
      } catch (err: any) {
        if (!mountedRef.current) return;
        stop();
        if (err?.name === 'NotAllowedError') setError('Izin kamera ditolak. Mohon izinkan akses kamera di pengaturan browser.');
        else if (err?.name === 'NotFoundError') setError('Kamera tidak ditemukan di perangkat ini.');
        else if (err?.name === 'NotReadableError') setError('Kamera sedang digunakan oleh aplikasi lain.');
        else setError('Gagal mengakses kamera. Coba lagi.');
        setIsLoading(false);
      }
    }

    start();

    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [onDetected, stop]);

  return (
    <div className="rounded-xl overflow-hidden border border-[#028697]/20 bg-black">
      <div className="relative w-full aspect-[4/3]">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/30" />
            <div className="relative w-52 h-32">
              <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl" />
              <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr" />
              <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl" />
              <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white rounded-br" />
              <div className="absolute inset-x-1 top-0 h-0.5 bg-[#028697] animate-scan-line" />
            </div>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-2">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
            <p className="text-white text-xs">Memulai kamera...</p>
          </div>
        )}
      </div>

      <div className="px-3 py-2 bg-gray-900 flex items-center justify-between">
        {error ? (
          <p className="text-xs text-red-400 flex-1">{error}</p>
        ) : isScanning ? (
          <p className="text-xs text-white/70 flex-1">Arahkan ke barcode kemasan produk</p>
        ) : (
          <p className="text-xs text-white/50 flex-1">Memulai kamera...</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-white/50 hover:text-white transition-colors ml-3 shrink-0"
        >
          Tutup
        </button>
      </div>

      <style>{`
        @keyframes scan-line {
          0%   { top: 0; }
          50%  { top: calc(100% - 2px); }
          100% { top: 0; }
        }
        .animate-scan-line { animation: scan-line 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────

export function VariantDialog({ mode, productId, productSku, variantCount = 0, defaultType = 'READY_STOCK', variantType, variant, trigger }: VariantDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isCreate = mode === 'create';
  // Determine effective initial type: edit uses variantType, create uses defaultType
  const initialType = isCreate ? defaultType : (variantType ?? 'READY_STOCK');
  const [selectedType, setSelectedType] = useState<'READY_STOCK' | 'PREORDER'>(initialType);
  const isPreorder = selectedType === 'PREORDER';

  const [variantName, setVariantName] = useState(variant?.name || '');
  const [skuOverride, setSkuOverride] = useState(false);
  const computedSku = isCreate && productSku ? autoGenerateSku(productSku, variantCount) : (variant?.sku || '');
  const [sku, setSku] = useState(computedSku);

  const [barcode, setBarcode] = useState(variant?.barcode || '');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  const [price, setPrice] = useState(variant?.price?.toString() || '');
  const [cost, setCost] = useState(variant?.cost?.toString() || '');
  const [points, setPoints] = useState(variant?.pointsPerUnit?.toString() || '0');
  const [stock, setStock] = useState('0');
  const [lowStock, setLowStock] = useState(variant?.lowStockAt?.toString() || '10');

  const formatNumber = (value: string): string => {
    const cleanValue = value.replace(/[^\d.]/g, '');
    const parts = cleanValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0];
  };

  const parseNumber = (value: string): string => value.replace(/,/g, '');

  const handleNumberChange = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => setter(formatNumber(value));

  const handleBarcodeDetected = useCallback((value: string) => {
    setBarcode(value);
    setShowBarcodeScanner(false);
    toast({ title: 'Barcode terdeteksi ✓', description: value });
  }, [toast]);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      formData.set('type', selectedType);
      formData.set('price', parseNumber(price));
      formData.set('cost', parseNumber(cost));
      formData.set('points', parseNumber(points));
      formData.set('lowStock', isPreorder ? '0' : parseNumber(lowStock));
      formData.set('barcode', barcode.trim());

      if (isCreate) {
        formData.set('stock', isPreorder ? '0' : parseNumber(stock));
      }
      if (isCreate && productId) {
        formData.append('productId', productId);
      }

      const result = isCreate
        ? await createVariantAction(formData)
        : await updateVariantAction(variant!.id, formData);

      if (result.success) {
        toast({
          title: isCreate ? 'Varian berhasil dibuat!' : 'Varian diperbarui!',
          description: isCreate
            ? 'Varian baru sudah ditambahkan ke produk.'
            : 'Perubahan berhasil disimpan.',
        });
        setOpen(false);
      } else {
        toast({
          title: 'Terjadi kesalahan',
          description: result.error || 'Gagal menyimpan varian.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Terjadi kesalahan',
        description: 'Permintaan tidak dapat diproses.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setSelectedType(isCreate ? defaultType : (variantType ?? 'READY_STOCK'));
      setVariantName(variant?.name || '');
      const newComputedSku = isCreate && productSku ? autoGenerateSku(productSku, variantCount) : (variant?.sku || '');
      setSku(newComputedSku);
      setSkuOverride(false);
      setBarcode(variant?.barcode || '');
      setShowBarcodeScanner(false);
      setPrice(formatNumber(variant?.price?.toString() || ''));
      setCost(formatNumber(variant?.cost?.toString() || ''));
      setPoints(formatNumber(variant?.pointsPerUnit?.toString() || '0'));
      setStock('0');
      setLowStock(formatNumber(variant?.lowStockAt?.toString() || '10'));
    } else {
      setShowBarcodeScanner(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant={isCreate ? 'outline' : 'ghost'} size="sm" className='text-[10px] sm:text-sm'>
            {isCreate ? (
              <>
                <Plus className="w-3 h-3" />
                Tambah Varian
              </>
            ) : (
              <Pencil className="w-3 h-3" />
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[520px] p-0 gap-0 overflow-hidden border-0 shadow-2xl max-h-[92vh] flex flex-col"
      >
        {/* Header band */}
        <div className="relative bg-gradient-to-br from-[#028697] to-[#015561] px-6 pt-6 pb-8 shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-8 w-16 h-16 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />

          <div className="relative flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <DialogHeader className="space-y-0.5 text-left p-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">
                {isCreate ? `Varian Baru` : 'Edit Varian'}
              </DialogTitle>
              <p className="text-white/65 text-xs font-normal">
                {isCreate ? 'Pilih tipe, atur harga dan stok varian' : `Mengedit: ${variant?.name}`}
              </p>
            </DialogHeader>
          </div>
        </div>
        {/* Form body — scrollable */}
        <form action={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 pt-5 pb-2 space-y-4 overflow-y-auto flex-1">

            {/* Variant Type Selector */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Tipe Varian</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'READY_STOCK' as const, icon: Package, label: 'Ready Stock', sublabel: 'Stok dilacak', activeClass: 'border-[#028697] bg-[#028697]/8 text-[#028697]' },
                  { value: 'PREORDER' as const, icon: Clock, label: 'Pre-Order', sublabel: 'Tanpa batas stok', activeClass: 'border-amber-500 bg-amber-50 text-amber-700' },
                ]).map(({ value, icon: Icon, label, sublabel, activeClass }) => {
                  const active = selectedType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSelectedType(value)}
                      disabled={loading}
                      className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-all disabled:opacity-50 ${
                        active ? activeClass : 'border-gray-100 bg-gray-50/60 text-gray-500 hover:border-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-tight">{label}</p>
                        <p className="text-[10px] opacity-60 leading-tight mt-0.5">{sublabel}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Name + SKU */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel icon={Tag} label="Nama Varian" required />
                <Input
                  id="name"
                  name="name"
                  required
                  value={variantName}
                  onChange={(e) => setVariantName(toTitleCase(e.target.value))}
                  placeholder="Contoh: 500gr, Coklat"
                  disabled={loading}
                  maxLength={30}
                  className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <FieldLabel label="Kode SKU" required />
                  {isCreate && productSku && (
                    <button
                      type="button"
                      onClick={() => setSkuOverride((v) => !v)}
                      className="text-[10px] text-[#028697] hover:underline shrink-0 -mt-1.5"
                    >
                      {skuOverride ? 'Auto' : 'Custom'}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <span className="text-[9px] font-mono border border-gray-300 rounded px-1 py-0.5 text-gray-400 leading-none">
                      SKU
                    </span>
                  </span>
                  <Input
                    id="sku"
                    name="sku"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    readOnly={isCreate && productSku != null && !skuOverride}
                    placeholder="KL-001-0A"
                    disabled={loading}
                    maxLength={20}
                    className={`pl-12 h-10 font-mono tracking-wider border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300 placeholder:font-sans placeholder:tracking-normal uppercase ${isCreate && productSku && !skuOverride ? 'bg-gray-50 text-gray-400 cursor-default' : ''}`}
                  />
                </div>
                {isCreate && productSku && !skuOverride && (
                  <p className="text-[10px] text-gray-300 mt-1">Auto dari kode produk</p>
                )}
              </div>
            </div>

            {/* Barcode field */}
            <div>
              <FieldLabel icon={Barcode} label="Barcode Kemasan" hint="Opsional" />
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="barcode-display"
                    name="barcode-display"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan atau ketik barcode..."
                    disabled={loading}
                    maxLength={50}
                    className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300 font-mono tracking-wide"
                  />
                  {barcode && (
                    <button
                      type="button"
                      onClick={() => setBarcode('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-400 transition-colors text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {/* Scan toggle button */}
                <button
                  type="button"
                  onClick={() => setShowBarcodeScanner((v) => !v)}
                  disabled={loading}
                  title={showBarcodeScanner ? 'Tutup scanner' : 'Scan barcode kemasan'}
                  className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border transition-all disabled:opacity-40 ${
                    showBarcodeScanner
                      ? 'bg-[#028697] border-[#028697] text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-[#028697] hover:text-[#028697]'
                  }`}
                >
                  {showBarcodeScanner ? (
                    <CameraOff className="w-4 h-4" />
                  ) : (
                    <ScanLine className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-gray-300 mt-1">
                Digunakan untuk scan produk saat transaksi. Harus unik per varian.
              </p>

              {/* Inline camera scanner */}
              {showBarcodeScanner && (
                <div className="mt-2">
                  <BarcodeScanner
                    onDetected={handleBarcodeDetected}
                    onClose={() => setShowBarcodeScanner(false)}
                  />
                </div>
              )}
            </div>

            {/* Pricing section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Harga</span>
                <div className="flex-1 border-t border-gray-100" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel label="Harga Jual" required />
                  <CurrencyInput
                    id="price"
                    name="price"
                    value={price}
                    onChange={(v) => handleNumberChange(v, setPrice)}
                    placeholder="0"
                    disabled={loading}
                  />
                </div>
                <div>
                  <FieldLabel label="Harga Modal" required />
                  <CurrencyInput
                    id="cost"
                    name="cost"
                    value={cost}
                    onChange={(v) => handleNumberChange(v, setCost)}
                    placeholder="0"
                    disabled={loading}
                  />
                </div>
              </div>

              {price && cost && !isNaN(parseFloat(parseNumber(price))) && !isNaN(parseFloat(parseNumber(cost))) && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-400">Margin:</span>
                  <span className={`text-[11px] font-semibold ${
                    parseFloat(parseNumber(price)) - parseFloat(parseNumber(cost)) >= 0
                      ? 'text-emerald-600'
                      : 'text-red-500'
                  }`}>
                    Rp {(parseFloat(parseNumber(price)) - parseFloat(parseNumber(cost))).toLocaleString('id-ID')}
                    {' '}
                    ({parseFloat(parseNumber(price)) > 0
                      ? Math.round(((parseFloat(parseNumber(price)) - parseFloat(parseNumber(cost))) / parseFloat(parseNumber(price))) * 100)
                      : 0}%)
                  </span>
                </div>
              )}
            </div>

            {/* Stock & reward section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  {isPreorder ? 'Reward' : 'Stok & Reward'}
                </span>
                <div className="flex-1 border-t border-gray-100" />
              </div>

              {!isPreorder ? (
                <div className={`grid gap-3 ${isCreate ? 'grid-cols-2' : 'grid-cols-2'}`}>
                  {isCreate && (
                    <div>
                      <FieldLabel icon={BarChart2} label="Stok Awal" required />
                      <Input
                        id="stock"
                        name="stock"
                        type="tel"
                        required
                        value={stock}
                        onChange={(e) => handleNumberChange(e.target.value, setStock)}
                        placeholder="0"
                        disabled={loading}
                        className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300 tabular-nums"
                      />
                    </div>
                  )}
                  <div>
                    <FieldLabel icon={AlertTriangle} label="Alert Stok" required />
                    <Input
                      id="lowStock"
                      name="lowStock"
                      type="tel"
                      required
                      value={lowStock}
                      onChange={(e) => handleNumberChange(e.target.value, setLowStock)}
                      placeholder="10"
                      disabled={loading}
                      className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300 tabular-nums"
                    />
                  </div>
                  <div>
                    <FieldLabel icon={Star} label="Poin/item" hint="Opsional" />
                    <Input
                      id="points"
                      name="points"
                      type="tel"
                      value={points}
                      onChange={(e) => handleNumberChange(e.target.value, setPoints)}
                      placeholder="0"
                      disabled={loading}
                      className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300 tabular-nums"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel icon={Star} label="Poin/item" hint="Opsional" />
                    <Input
                      id="points"
                      name="points"
                      type="tel"
                      value={points}
                      onChange={(e) => handleNumberChange(e.target.value, setPoints)}
                      placeholder="0"
                      disabled={loading}
                      className="h-10 border-gray-200 focus-visible:ring-[#028697]/30 focus-visible:border-[#028697] transition-colors placeholder:text-gray-300 tabular-nums"
                    />
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <p className="text-[11px] text-amber-700 leading-snug">
                      Stok tidak dilacak — dijual tanpa batas stok
                    </p>
                  </div>
                </div>
              )}

              {!isPreorder && (
                <p className="mt-2 text-[11px] text-gray-400">
                  Poin diberikan ke member untuk tiap unit yang dibeli.
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#028697] hover:bg-[#017585] text-white shadow-sm min-w-[120px] transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menyimpan...
                </span>
              ) : isCreate ? (
                <span className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  Buat Varian
                </span>
              ) : (
                'Simpan Perubahan'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}