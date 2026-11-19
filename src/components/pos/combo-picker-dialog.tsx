'use client';

import { useState } from 'react';
import { Check, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, formatCurrency } from '@/lib/utils';
import {
  resolveComboSelection,
  type ComboInfo,
  type ComboSelections,
  type ResolvedComboLine,
} from '@/lib/combo-pricing';

/** Satu paket di keranjang kasir (harga di sini hanya preview; server menghitung ulang). */
export interface ComboCartLine {
  key:          string;
  comboId:      string;
  name:         string;
  packagePrice: number;
  selections:   ComboSelections;
  lines:        ResolvedComboLine[];
  itemsTotal:   number;
  discount:     number;
}

interface Props {
  combo:     ComboInfo;
  onClose:   () => void;
  /** Sisa stok varian setelah dikurangi isi keranjang (Infinity untuk pre-order). */
  remaining: (variantId: string) => number;
  onAdd:     (line: ComboCartLine) => void;
}

const newKey = () => `combo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function ComboPickerDialog({ combo, onClose, remaining, onAdd }: Props) {
  const [selections, setSelections] = useState<ComboSelections>({});

  const resolution = resolveComboSelection(combo, selections);

  const selectedId = (slotId: string, isRequired: boolean, variantCount: number): string | undefined => {
    if (selections[slotId]) return selections[slotId];
    // Wajib + hanya satu varian → otomatis ikut (sama seperti perhitungan server)
    if (isRequired && variantCount === 1) return combo.slots.find((s) => s.id === slotId)?.variants[0]?.id;
    return undefined;
  };

  const pick = (slotId: string, variantId: string, isRequired: boolean) =>
    setSelections((prev) => {
      const next = { ...prev };
      if (next[slotId] === variantId && !isRequired) delete next[slotId]; // opsional: ketuk lagi untuk melepas
      else next[slotId] = variantId;
      return next;
    });

  const outOfStockLine =
    resolution.ok ? resolution.lines.find((l) => remaining(l.variantId) < 1) : undefined;
  const canAdd = resolution.ok && !outOfStockLine;

  const handleAdd = () => {
    if (!resolution.ok || outOfStockLine) return;
    // Sertakan isi otomatis agar selections lengkap (server tetap memvalidasi ulang)
    const full: ComboSelections = {};
    for (const l of resolution.lines) full[l.slotId] = l.variantId;
    onAdd({
      key:          newKey(),
      comboId:      combo.id,
      name:         combo.name,
      packagePrice: combo.price,
      selections:   full,
      lines:        resolution.lines,
      itemsTotal:   resolution.itemsTotal,
      discount:     resolution.discount,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[480px] p-0 gap-0 overflow-hidden border-0 shadow-2xl max-h-[92vh] flex flex-col"
      >
        <div className="bg-gradient-to-br from-[#028697] to-[#015561] px-5 sm:px-6 pt-5 sm:pt-6 pb-5 shrink-0">
          <div className="flex items-center gap-3 pr-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <DialogHeader className="min-w-0 space-y-0.5 p-0 text-left">
              <DialogTitle className="truncate text-lg font-semibold leading-tight text-white">{combo.name}</DialogTitle>
              <p className="text-xs font-normal text-white/70">Harga paket {formatCurrency(combo.price)}</p>
            </DialogHeader>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 sm:px-6 pt-5 pb-3">
          {combo.slots.map((slot) => {
            const chosen = selectedId(slot.id, slot.isRequired, slot.variants.length);
            const fixed  = slot.isRequired && slot.variants.length === 1;
            return (
              <div key={slot.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{slot.productName}</p>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium',
                    slot.isRequired ? 'bg-[#028697]/10 text-[#028697]' : 'bg-gray-100 text-gray-500'
                  )}>
                    {fixed ? 'Sudah termasuk' : slot.isRequired ? 'Pilih 1' : 'Opsional'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {slot.variants.map((v) => {
                    const left     = remaining(v.id);
                    const soldOut  = left < 1;
                    const isChosen = chosen === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={soldOut || fixed}
                        onClick={() => pick(slot.id, v.id, slot.isRequired)}
                        aria-pressed={isChosen}
                        className={cn(
                          'relative min-h-[52px] rounded-xl border-2 px-3 py-2 text-left transition-all',
                          isChosen
                            ? 'border-[#028697] bg-[#028697]/5'
                            : 'border-gray-100 bg-gray-50/60 hover:border-gray-200',
                          soldOut && 'cursor-not-allowed opacity-40'
                        )}
                      >
                        {isChosen && <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-[#028697]" />}
                        <p className="pr-4 text-xs font-semibold leading-tight">{v.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatCurrency(v.price)}
                          {soldOut ? ' · Habis' : Number.isFinite(left) && left <= 5 ? ` · Sisa ${left}` : ''}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="shrink-0 space-y-3 border-t border-gray-100 bg-gray-50/50 px-5 sm:px-6 py-4">
          {resolution.ok ? (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Harga satuan ({resolution.lines.length} item)</span>
                <span>{formatCurrency(resolution.itemsTotal)}</span>
              </div>
              {resolution.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Diskon paket</span>
                  <span>− {formatCurrency(resolution.discount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-sm font-bold">
                <span>Harga paket</span>
                <span className="text-[#028697]">{formatCurrency(resolution.charged)}</span>
              </div>
              {outOfStockLine && (
                <p className="text-red-500">Stok {outOfStockLine.productName} – {outOfStockLine.variantName} tidak cukup.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{resolution.error}</p>
          )}

          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onClose} className="py-2 pr-2 text-sm text-gray-400 transition-colors hover:text-gray-600">
              Batal
            </button>
            <Button onClick={handleAdd} disabled={!canAdd} className="min-w-[160px] bg-[#028697] text-white hover:bg-[#017585]">
              Tambah ke Keranjang
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
