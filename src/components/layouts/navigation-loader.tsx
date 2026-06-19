'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// ─── Module-level trigger ─────────────────────────────────────────────────────
// Memungkinkan navigation.tsx & tab-layout.tsx memanggil triggerLoader()
// tanpa perlu context atau prop drilling.

type SetLoadingFn = (v: boolean) => void;
let _setLoading: SetLoadingFn | null = null;

export function triggerLoader() {
  _setLoading?.(true);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NavigationLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const prevPathname = useRef(pathname);

  // Register setter agar triggerLoader() bisa menyalakan overlay ini
  useEffect(() => {
    _setLoading = setLoading;
    return () => { _setLoading = null; };
  }, []);

  // Matikan overlay begitu pathname benar-benar sudah berubah
  // (artinya halaman baru sudah selesai di-render oleh Next.js)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      setLoading(false);
      prevPathname.current = pathname;
    }
  }, [pathname]);

  if (!loading) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-[1px]"
      aria-label="Memuat halaman..."
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/90 px-8 py-6 shadow-xl">
        <Loader2 className="w-8 h-8 animate-spin text-[#028697]" />
        <p className="text-sm font-medium text-gray-600">Memuat...</p>
      </div>
    </div>
  );
}
