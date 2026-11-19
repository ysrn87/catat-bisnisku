'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Layers, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createComboAction, updateComboAction, type AdminCombo, type ComboFormProduct } from '@/actions/combos';
import { formatCurrency } from '@/lib/utils';

interface SlotState {
  key:        string;
  productId:  string;
  isRequired: boolean;
  variantIds: string[];
}

interface Props {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  combo:        AdminCombo | null; // null = buat baru
  products:     ComboFormProduct[];
}

let keySeq = 0;
const newKey = () => `slot-${++keySeq}`;
const digitsOnly = (v: string) => v.replace(/[^\d]/g, '');
const formatDigits = (v: string) => (v ? Number(v).toLocaleString('id-ID') : '');

function initialSlots(combo: AdminCombo | null): SlotState[] {
  if (!combo) return [{ key: newKey(), productId: '', isRequired: true, variantIds: [] }];
  return combo.slots.map((s) => ({
    key: newKey(), productId: s.productId, isRequired: s.isRequired, variantIds: s.variants.map((v) => v.id),
  }));
}

export function ComboFormDialog({ open, onOpenChange, combo, products }: Props) {
  // Remount per pembukaan (key dari parent) → state awal selalu segar
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName]         = useState(combo?.name ?? '');
  const [priceRaw, setPriceRaw] = useState(combo ? String(Math.round(combo.price)) : '');
  const [isActive, setIsActive] = useState(combo?.isActive ?? true);
  const [slots, setSlots]       = useState<SlotState[]>(() => initialSlots(combo));
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const usedProductIds = new Set(slots.map((s) => s.productId).filter(Boolean));

  const updateSlot = (key: string, patch: Partial<SlotState>) =>
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const toggleVariant = (key: string, variantId: string) =>
    setSlots((prev) =>
      prev.map((s) =>
        s.key !== key
          ? s
          : { ...s, variantIds: s.variantIds.includes(variantId) ? s.variantIds.filter((v) => v !== variantId) : [...s.variantIds, variantId] }
      )
    );

  // Perkiraan harga satuan dari slot WAJIB (rentang termurah – termahal)
  const price = Number(priceRaw || 0);
  const range = useMemo(() => {
    let min = 0, max = 0;
    for (const s of slots) {
      if (!s.isRequired || s.variantIds.length === 0) continue;
      const prices = s.variantIds
        .map((id) => productById.get(s.productId)?.variants.find((v) => v.id === id)?.price)
        .filter((p): p is number => typeof p === 'number');
      if (prices.length === 0) continue;
      min += Math.min(...prices);
      max += Math.max(...prices);
    }
    return { min, max };
  }, [slots, productById]);

  const canSubmit =
    name.trim().length >= 2 && price > 0 && slots.length > 0 &&
    slots.every((s) => s.productId && s.variantIds.length > 0) && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    const input = {
      name, price, isActive,
      slots: slots.map((s) => ({ productId: s.productId, isRequired: s.isRequired, variantIds: s.variantIds })),
    };
    const res = combo ? await updateComboAction(combo.id, input) : await createComboAction(input);

    if (res.success) {
      toast({ title: combo ? 'Paket diperbarui' : 'Paket dibuat', description: name });
      onOpenChange(false);
      router.refresh();
    } else {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[560px] p-0 gap-0 overflow-hidden border-0 shadow-2xl max-h-[92vh] flex flex-col"
      >
        <div className="relative bg-gradient-to-br from-[#028697] to-[#015561] px-5 sm:px-6 pt-5 sm:pt-6 pb-5 shrink-0">
          <div className="relative flex items-center gap-3 pr-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <DialogHeader className="min-w-0 space-y-0.5 p-0 text-left">
              <DialogTitle className="text-lg font-semibold leading-tight text-white">
                {combo ? 'Ubah Paket' : 'Buat Paket Baru'}
              </DialogTitle>
              <p className="text-xs font-normal text-white/65">Gabungkan varian produk dengan harga paket</p>
            </DialogHeader>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-5 sm:px-6 pt-5 pb-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="combo-name" className="text-xs font-medium text-gray-600">Nama paket <span className="text-red-400">*</span></label>
                <Input id="combo-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
                  placeholder="Contoh: Paket Ayam" disabled={loading} className="h-10 border-gray-200" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="combo-price" className="text-xs font-medium text-gray-600">Harga paket <span className="text-red-400">*</span></label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">Rp</span>
                  <Input id="combo-price" type="tel" inputMode="numeric" autoComplete="off"
                    value={formatDigits(priceRaw)} onChange={(e) => setPriceRaw(digitsOnly(e.target.value).slice(0, 8))}
                    placeholder="15.000" disabled={loading} className="h-10 border-gray-200 pl-9 tabular-nums" />
                </div>
              </div>

              <div className="flex items-end justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-gray-600">Status</p>
                  <p className="text-[11px] text-gray-400">{isActive ? 'Tampil di kasir' : 'Disembunyikan dari kasir'}</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} disabled={loading} />
              </div>
            </div>

            <div className="border-t border-gray-100" />

            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Isi paket</p>
                <p className="mt-1 text-xs text-gray-500">
                  Pilih produk, lalu centang varian yang boleh dipilih. Satu varian = otomatis ikut.
                  Lebih dari satu = kasir memilih salah satu.
                </p>
              </div>

              {slots.map((slot, index) => {
                const product = productById.get(slot.productId);
                const n = slot.variantIds.length;
                return (
                  <div key={slot.key} className="space-y-3 rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={slot.productId}
                        onChange={(e) => updateSlot(slot.key, { productId: e.target.value, variantIds: [] })}
                        disabled={loading}
                        aria-label={`Produk ${index + 1}`}
                        className="h-10 min-w-0 flex-1 rounded-md border border-gray-200 bg-background px-3 text-sm"
                      >
                        <option value="">Pilih produk…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id} disabled={usedProductIds.has(p.id) && p.id !== slot.productId}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {slots.length > 1 && (
                        <button type="button" onClick={() => setSlots((prev) => prev.filter((s) => s.key !== slot.key))}
                          disabled={loading} aria-label="Hapus produk dari paket"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {product && (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {product.variants.map((v) => {
                            const checked = slot.variantIds.includes(v.id);
                            return (
                              <button
                                key={v.id} type="button" disabled={loading || !v.isActive}
                                onClick={() => toggleVariant(slot.key, v.id)} aria-pressed={checked}
                                className={`min-h-[40px] rounded-lg border-2 px-3 py-1.5 text-left text-xs transition-colors disabled:opacity-40 ${
                                  checked ? 'border-[#028697] bg-[#028697]/5 text-[#028697]' : 'border-gray-100 bg-gray-50/60 text-gray-600 hover:border-gray-200'
                                }`}
                              >
                                <span className="font-semibold">{v.name}</span>
                                <span className="ml-1.5 opacity-70">{formatCurrency(v.price)}{!v.isActive ? ' · nonaktif' : ''}</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className={`text-[11px] ${n === 0 ? 'text-red-500' : 'text-gray-500'}`}>
                            {n === 0 ? 'Pilih minimal 1 varian.' : n === 1 ? 'Otomatis ikut di paket.' : `Kasir memilih 1 dari ${n} varian.`}
                          </p>
                          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
                            <input type="checkbox" checked={slot.isRequired} disabled={loading}
                              onChange={(e) => updateSlot(slot.key, { isRequired: e.target.checked })}
                              className="h-4 w-4 accent-[#028697]" />
                            Wajib dipilih
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              <Button type="button" variant="outline" size="sm" disabled={loading || usedProductIds.size >= products.length}
                onClick={() => setSlots((prev) => [...prev, { key: newKey(), productId: '', isRequired: true, variantIds: [] }])}
                className="w-full border-dashed">
                <Plus className="mr-1.5 h-4 w-4" /> Tambah produk
              </Button>
            </div>

            {range.max > 0 && (
              <div className="space-y-1.5 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
                <p>
                  Harga satuan isi wajib: <strong>{formatCurrency(range.min)}</strong>
                  {range.max !== range.min && <> – <strong>{formatCurrency(range.max)}</strong></>}
                </p>
                {price > 0 && range.min < price && (
                  <p className="flex items-start gap-1.5 text-amber-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Kombinasi termurah ({formatCurrency(range.min)}) lebih murah dari harga paket. Untuk kombinasi itu
                    pelanggan membayar harga satuan, tanpa biaya tambahan.
                  </p>
                )}
              </div>
            )}

            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/50 px-5 sm:px-6 py-4">
            <button type="button" onClick={() => onOpenChange(false)} disabled={loading}
              className="py-2 pr-2 text-sm text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50">
              Batal
            </button>
            <Button type="submit" disabled={!canSubmit} className="min-w-[130px] bg-[#028697] text-white hover:bg-[#017585]">
              {loading ? <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyimpan...</span> : 'Simpan Paket'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
