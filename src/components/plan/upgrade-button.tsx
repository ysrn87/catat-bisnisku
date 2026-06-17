'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSnapToken } from '@/actions/upgrade';

// Declare Snap global yang diinject oleh Snap.js Midtrans
declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?:  (result: unknown) => void;
          onPending?:  (result: unknown) => void;
          onError?:    (result: unknown) => void;
          onClose?:    () => void;
        }
      ) => void;
    };
  }
}

interface UpgradeButtonProps {
  storeSlug: string;
}

/**
 * Tombol upgrade PRO yang menggunakan Midtrans Snap popup.
 *
 * Flow:
 *   1. User klik → createSnapToken() dipanggil (server action)
 *   2. Dapat token → load Snap.js kalau belum ada
 *   3. window.snap.pay(token) → popup Midtrans muncul
 *   4. Setelah bayar → webhook /api/midtrans/webhook otomatis upgrade store
 *   5. onSuccess → redirect ke halaman success
 */
export function UpgradeButton({ storeSlug }: UpgradeButtonProps) {
  const router  = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'paying'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Load Snap.js script secara dinamis (hanya sekali)
  const loadSnapScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Kalau sudah ada, langsung resolve
      if (window.snap) { resolve(); return; }

      const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';
      const scriptSrc = isProduction
        ? 'https://app.midtrans.com/snap/snap.js'
        : 'https://app.sandbox.midtrans.com/snap/snap.js';

      const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);
      if (existingScript) {
        // Script sudah ada tapi window.snap belum ready — tunggu sebentar
        setTimeout(resolve, 300);
        return;
      }

      const script    = document.createElement('script');
      script.src      = scriptSrc;
      script.async    = true;
      script.setAttribute(
        'data-client-key',
        process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
      );
      script.onload   = () => resolve();
      script.onerror  = () => reject(new Error('Gagal memuat payment gateway'));
      document.head.appendChild(script);
    });
  };

  const handleUpgrade = async () => {
    setError(null);
    setState('loading');

    try {
      // 1. Minta token dari server
      const result = await createSnapToken(storeSlug);

      if (!result.success) {
        setError(result.error);
        setState('idle');
        return;
      }

      // 2. Load Snap.js
      await loadSnapScript();

      if (!window.snap) {
        setError('Payment gateway gagal dimuat. Refresh halaman dan coba lagi.');
        setState('idle');
        return;
      }

      setState('paying');

      // 3. Buka popup Midtrans
      window.snap.pay(result.token, {
        onSuccess: () => {
          // Webhook sudah handle upgrade di backend
          // Redirect ke halaman success untuk konfirmasi ke user
          router.push(`/${storeSlug}/upgrade/success`);
        },
        onPending: () => {
          // Transfer bank / convenience store — masih menunggu
          router.push(`/${storeSlug}/upgrade/pending`);
        },
        onError: () => {
          setError('Pembayaran gagal. Silakan coba lagi.');
          setState('idle');
        },
        onClose: () => {
          // User tutup popup tanpa bayar
          setState('idle');
        },
      });

    } catch (err) {
      console.error('[UpgradeButton]', err);
      setError('Terjadi kesalahan. Silakan coba lagi.');
      setState('idle');
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleUpgrade}
        disabled={state === 'loading' || state === 'paying'}
        className="w-full h-12 text-base font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-lg disabled:opacity-70"
      >
        {state === 'loading' ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...</>
        ) : state === 'paying' ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menunggu Pembayaran...</>
        ) : (
          <><Crown className="w-4 h-4 mr-2" /> Upgrade Sekarang — Rp 99.000/bln</>
        )}
      </Button>

      {error && (
        <p className="text-center text-xs text-red-500">{error}</p>
      )}

      <p className="text-center text-xs text-gray-400">
        Pembayaran aman via Midtrans · Transfer Bank, QRIS, e-Wallet
      </p>
    </div>
  );
}
