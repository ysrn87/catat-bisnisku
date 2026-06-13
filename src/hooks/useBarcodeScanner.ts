'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface UseBarcodeScanner {
  isScanning: boolean;
  isLoading: boolean;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startScan: () => Promise<void>;
  stopScan: () => void;
}

export function useBarcodeScanner(
  onDetected: (barcode: string) => void
): UseBarcodeScanner {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScan();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopScan = useCallback(() => {
    // Stop ZXing reader
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch {
        // ignore
      }
      readerRef.current = null;
    }

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (mountedRef.current) {
      setIsScanning(false);
      setIsLoading(false);
    }
  }, []);

  const startScan = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Dynamically import ZXing to avoid SSR issues
      const { BrowserMultiFormatReader, NotFoundException } = await import('@zxing/library');

      // Request rear camera — critical for mobile kasir use case
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      if (mountedRef.current) {
        setIsScanning(true);
        setIsLoading(false);
      }

      // Continuously decode from video stream
      reader.decodeFromStream(stream, videoRef.current!, (result, err) => {
        if (!mountedRef.current) return;

        if (result) {
          const barcodeValue = result.getText();
          onDetected(barcodeValue);
          stopScan();
          return;
        }

        // NotFoundException fires every frame when no barcode is in view — ignore it
        if (err && !(err instanceof NotFoundException)) {
          console.warn('Barcode scan error:', err);
        }
      });
    } catch (err: any) {
      if (!mountedRef.current) return;

      stopScan();

      if (err?.name === 'NotAllowedError') {
        setError('Izin kamera ditolak. Mohon izinkan akses kamera di pengaturan browser.');
      } else if (err?.name === 'NotFoundError') {
        setError('Kamera tidak ditemukan di perangkat ini.');
      } else if (err?.name === 'NotReadableError') {
        setError('Kamera sedang digunakan oleh aplikasi lain.');
      } else {
        setError('Gagal mengakses kamera. Coba lagi.');
      }

      setIsLoading(false);
    }
  }, [onDetected, stopScan]);

  return { isScanning, isLoading, error, videoRef, startScan, stopScan };
}