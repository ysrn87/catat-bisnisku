'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScanBarcode, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

interface ScannerDialogProps {
  open: boolean;
  onClose: () => void;
  /** Kembalikan teks hasil (mis. "Kopi Susu +1") atau null bila barcode tidak dikenal. */
  onDetected: (barcode: string) => string | null;
}

/**
 * Scanner kamera mode beruntun: setelah satu barcode terbaca, produk masuk keranjang
 * dan kamera otomatis siap memindai berikutnya — kasir menutup sendiri bila sudah selesai.
 */
export function ScannerDialog({ open, onClose, onDetected }: ScannerDialogProps) {
  const [last, setLast] = useState<{ text: string; ok: boolean } | null>(null);
  const [count, setCount] = useState(0);
  const openRef = useRef(open);
  openRef.current = open;
  const restartRef = useRef<() => void>(() => {});
  const lastScan = useRef({ code: '', at: 0 });

  const handleDetected = useCallback((code: string) => {
    // Barcode yang sama masih di depan kamera → jangan ditambahkan berulang
    const now = Date.now();
    const duplicate = lastScan.current.code === code && now - lastScan.current.at < 2000;
    lastScan.current = { code, at: now };
    if (duplicate) {
      window.setTimeout(() => { if (openRef.current) restartRef.current(); }, 600);
      return;
    }
    const text = onDetected(code);
    setLast({ text: text ?? `Barcode ${code} tidak terdaftar`, ok: text !== null });
    if (text !== null) setCount((c) => c + 1);
    // Siap memindai lagi setelah jeda singkat (hook berhenti sendiri tiap kali berhasil membaca)
    window.setTimeout(() => { if (openRef.current) restartRef.current(); }, 900);
  }, [onDetected]);

  const { isScanning, isLoading, error, videoRef, startScan, stopScan } = useBarcodeScanner(handleDetected);
  restartRef.current = startScan;

  // Mulai sekali saat dialog terbuka (beri waktu elemen <video> ter-mount); berhenti saat ditutup
  useEffect(() => {
    if (!open) { stopScan(); setLast(null); setCount(0); return; }
    const t = window.setTimeout(() => { void restartRef.current(); }, 200);
    return () => window.clearTimeout(t);
  }, [open, stopScan]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[420px] p-0 gap-0 overflow-hidden border-0 shadow-2xl"
      >
        <div className="flex items-center gap-3 bg-gradient-to-br from-[#028697] to-[#015561] px-5 py-4 pr-12">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
            <ScanBarcode className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base font-semibold text-white">Scan Barcode</DialogTitle>
            <p className="text-xs text-white/70">{count > 0 ? `${count} produk ditambahkan` : 'Arahkan kamera ke barcode produk'}</p>
          </div>
        </div>

        <div className="relative aspect-[4/3] bg-black">
          {open && (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
            />
          )}
          {isScanning && (
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-red-500/80" />
          )}
          {isLoading && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Membuka kamera...</p>}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-sm text-red-300">{error}</p>
              <button type="button" onClick={() => void startScan()} className="rounded-lg bg-white/15 px-3 py-1.5 text-xs text-white hover:bg-white/25">
                Coba lagi
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3" aria-live="polite">
          <p className={last ? (last.ok ? 'truncate text-sm font-medium text-emerald-600' : 'truncate text-sm font-medium text-red-600') : 'text-sm text-muted-foreground'}>
            {last ? last.text : 'Menunggu barcode...'}
          </p>
          <button type="button" onClick={onClose} className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <X className="h-3.5 w-3.5" /> Selesai
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
