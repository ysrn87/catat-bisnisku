// Logika harga & validasi pilihan paket. Fungsi MURNI tanpa import server-only,
// jadi dipakai di client (preview kasir) dan di server (sumber kebenaran).

export interface ComboVariantInfo {
  id:            string;
  name:          string;
  price:         number;
  stock:         number;
  type:          string; // READY_STOCK | PREORDER | ...
  isActive:      boolean;
  pointsPerUnit: number;
}

/** Satu slot = satu PRODUK di dalam paket, dengan varian yang boleh dipilih. */
export interface ComboSlotInfo {
  id:          string; // ComboItem.id
  productId:   string;
  productName: string;
  isRequired:  boolean;
  variants:    ComboVariantInfo[];
}

export interface ComboInfo {
  id:    string;
  name:  string;
  price: number;
  slots: ComboSlotInfo[];
}

/** slotId → variantId. Slot wajib dengan 1 varian tersedia diisi otomatis. */
export type ComboSelections = Record<string, string>;

export interface ResolvedComboLine {
  slotId:        string;
  productName:   string;
  variantId:     string;
  variantName:   string;
  price:         number;
  quantity:      1;
  pointsPerUnit: number;
  stock:         number;
  type:          string;
}

export type ComboResolution =
  | {
      ok:           true;
      lines:        ResolvedComboLine[];
      itemsTotal:   number; // jumlah harga satuan
      packagePrice: number;
      discount:     number; // max(0, itemsTotal - packagePrice)
      charged:      number; // itemsTotal - discount
    }
  | { ok: false; error: string };

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function resolveComboSelection(combo: ComboInfo, selections: ComboSelections): ComboResolution {
  const slotIds = new Set(combo.slots.map((s) => s.id));
  for (const key of Object.keys(selections ?? {})) {
    if (!slotIds.has(key)) return { ok: false, error: 'Pilihan paket tidak valid.' };
  }

  const lines: ResolvedComboLine[] = [];

  for (const slot of combo.slots) {
    const usable = slot.variants.filter((v) => v.isActive);
    const chosenId = selections?.[slot.id];
    let variant: ComboVariantInfo | undefined;

    if (chosenId) {
      const configured = slot.variants.find((v) => v.id === chosenId);
      if (!configured) return { ok: false, error: `Pilihan untuk ${slot.productName} tidak valid.` };
      if (!configured.isActive) return { ok: false, error: `${slot.productName} – ${configured.name} tidak tersedia.` };
      variant = configured;
    } else if (slot.isRequired) {
      if (usable.length === 0) return { ok: false, error: `${slot.productName} tidak tersedia.` };
      if (usable.length > 1) return { ok: false, error: `Pilih ${slot.productName} terlebih dahulu.` };
      variant = usable[0]; // hanya satu pilihan → otomatis ikut
    } else {
      continue; // slot opsional dan tidak dipilih
    }

    lines.push({
      slotId:        slot.id,
      productName:   slot.productName,
      variantId:     variant.id,
      variantName:   variant.name,
      price:         variant.price,
      quantity:      1,
      pointsPerUnit: variant.pointsPerUnit,
      stock:         variant.stock,
      type:          variant.type,
    });
  }

  if (lines.length === 0) return { ok: false, error: 'Pilih minimal satu isi paket.' };

  const itemsTotal = round2(lines.reduce((sum, l) => sum + l.price, 0));
  const discount   = round2(Math.max(0, itemsTotal - combo.price));
  return {
    ok: true,
    lines,
    itemsTotal,
    packagePrice: combo.price,
    discount,
    charged: round2(itemsTotal - discount),
  };
}

/** Batas kuantitas paket per satu baris keranjang (harus sama dengan batas di server). */
export const MAX_COMBO_QUANTITY = 500;

/**
 * Berapa unit paket dengan isi yang sama masih bisa dibuat dari stok tersisa.
 * `remaining(variantId)` = sisa stok varian (Infinity untuk pre-order).
 * Tiap isi paket memakai 1 unit varian per paket.
 */
export function maxComboQuantity(
  lines: Array<{ variantId: string }>,
  remaining: (variantId: string) => number,
): number {
  // Varian yang sama bisa muncul di beberapa slot → kebutuhan per paket = jumlah kemunculannya
  const perCombo = new Map<string, number>();
  for (const l of lines) perCombo.set(l.variantId, (perCombo.get(l.variantId) ?? 0) + 1);
  let max = MAX_COMBO_QUANTITY;
  for (const [variantId, n] of perCombo) max = Math.min(max, Math.floor(remaining(variantId) / n));
  return Math.max(0, max);
}
