'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

/** Kontrol jumlah paket di keranjang: tombol −/+ dan kolom ketik (mis. 100) tanpa menekan satu per satu. */
export function ComboQtyControl({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const commit = () => {
    const n = Number.parseInt(text, 10);
    onChange(Number.isFinite(n) && n > 0 ? n : value);
    setText(String(Number.isFinite(n) && n > 0 ? Math.min(n, max) : value));
  };
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#028697]/30 bg-white transition-colors hover:bg-[#028697]/10 disabled:opacity-40"
        aria-label="Kurangi jumlah paket">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input type="text" inputMode="numeric" value={text} aria-label="Jumlah paket"
        onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 3))}
        onFocus={(e) => e.target.select()} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="h-7 w-12 rounded-md border border-[#028697]/30 bg-white text-center text-xs font-semibold tabular-nums focus:border-[#028697] focus:outline-none" />
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#028697]/30 bg-white transition-colors hover:bg-[#028697]/10 disabled:opacity-40"
        aria-label="Tambah jumlah paket">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
