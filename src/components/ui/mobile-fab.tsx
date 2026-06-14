'use client';

import { useEffect, useState } from 'react';

interface MobileFabProps {
  children: React.ReactNode;
}

/**
 * Wrapper yang hanya render children di client-side.
 * Mencegah hydration mismatch pada Radix UI Dialog yang punya
 * ID dinamis (aria-controls) saat ada dua instance di satu halaman
 * (satu desktop, satu mobile FAB).
 */
export function MobileFab({ children }: MobileFabProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="sm:hidden fixed bottom-24 right-6 z-50">
      {children}
    </div>
  );
}
