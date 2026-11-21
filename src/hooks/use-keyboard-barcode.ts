'use client';

import { useEffect, useRef } from 'react';

/**
 * Scanner barcode USB/Bluetooth bekerja seperti keyboard: mengetik kode sangat cepat lalu Enter.
 * Hook ini mengenali pola itu (jeda antar-karakter < 50 ms) sehingga ketikan manusia
 * tidak pernah dianggap scan. Tidak aktif saat fokus ada di kolom isian lain
 * (kecuali kolom bertanda data-barcode-ok, mis. pencarian produk).
 */
export function useKeyboardBarcode(onScan: (code: string) => void, enabled: boolean) {
  const buffer = useRef('');
  const lastKey = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const isField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable;
      if (isField && !el?.hasAttribute('data-barcode-ok')) return;

      const now = performance.now();
      if (now - lastKey.current > 50) buffer.current = ''; // jeda panjang → ketikan manusia
      lastKey.current = now;

      if (e.key === 'Enter') {
        const code = buffer.current;
        buffer.current = '';
        if (code.length >= 4) {
          e.preventDefault();
          e.stopPropagation(); // jangan diproses lagi oleh Enter handler kolom pencarian
          onScan(code);
        }
        return;
      }
      if (e.key.length === 1) buffer.current += e.key;
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onScan, enabled]);
}
