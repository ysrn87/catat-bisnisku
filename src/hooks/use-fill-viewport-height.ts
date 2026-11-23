'use client';

import { useEffect, useState, type RefObject } from 'react';

interface Options {
  /** Lebar minimum viewport (px) agar tinggi diukur. Di bawah itu, kembalikan null (pakai CSS). */
  minWidth?: number;
  /** Ruang kosong di bawah container (px), mis. padding bawah <main>. */
  bottomGap?: number;
  /** Tinggi minimum (px) agar layout tidak rusak di layar sangat pendek. */
  minHeight?: number;
}

/**
 * Mengukur sisa tinggi layar dari posisi atas container sampai dasar viewport,
 * sehingga container pas satu layar dan halaman tidak ikut scroll.
 * Mengembalikan null saat belum terukur / viewport di bawah `minWidth`.
 */
export function useFillViewportHeight(
  ref: RefObject<HTMLElement | null>,
  { minWidth = 1024, bottomGap = 32, minHeight = 320 }: Options = {}
): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el || window.innerWidth < minWidth) {
        setHeight(null);
        return;
      }
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(minHeight, Math.floor(window.innerHeight - top - bottomGap)));
    };

    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('load', measure);
    };
  }, [ref, minWidth, bottomGap, minHeight]);

  // Koreksi otomatis: bila halaman masih lebih tinggi dari layar (ada elemen/padding lain
  // yang tidak terhitung), kecilkan container sebesar kelebihannya sampai tidak ada scroll halaman.
  useEffect(() => {
    if (height === null) return;
    const raf = requestAnimationFrame(() => {
      const doc = document.documentElement;
      const overflow = doc.scrollHeight - doc.clientHeight;
      if (overflow > 1) setHeight(Math.max(minHeight, height - overflow));
    });
    return () => cancelAnimationFrame(raf);
  }, [height, minHeight]);

  return height;
}
