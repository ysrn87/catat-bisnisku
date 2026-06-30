'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Crown, Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { removeStoreLogoAction, getStoreBranding } from '@/actions/settings';
import Link from 'next/link';

interface BrandingTabProps {
  storeSlug: string;
  storeId:   string;
  storePlan: 'FREE' | 'PRO';
}

const MAX_LOGO_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
const ALLOWED_LOGO_TYPES  = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Tab branding di halaman settings — PRO only.
 * Logo disimpan di Vercel Blob, bukan base64 di database — upload dan hapus
 * dieksekusi langsung saat tombol diklik (bukan ditunda sampai "Simpan"),
 * karena masing-masing sudah jadi Server Action tersendiri yang independen.
 */
export function BrandingTab({ storeSlug, storeId, storePlan }: BrandingTabProps) {
  const [logoUrl, setLogoUrl]         = useState<string | null>(null);
  const [storeName, setStoreName]     = useState('');
  const [uploading, setUploading]     = useState(false);
  const [removing, setRemoving]       = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast }    = useToast();

  useEffect(() => {
    getStoreBranding().then(({ logoUrl, storeName }) => {
      setLogoUrl(logoUrl);
      setStoreName(storeName);
      setLoadingInitial(false);
    });
  }, []);

  // FREE plan — tampilkan upgrade prompt
  if (storePlan !== 'PRO') {
    return (
      <Card className="border-amber-200">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center">
            <Crown className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-800">Custom Branding — Fitur PRO</p>
            <p className="text-sm text-gray-500 mt-1 max-w-xs">
              Upload logo toko untuk tampil di aplikasi kasir dan struk digital.
            </p>
          </div>
          <Link href={`/${storeSlug}/upgrade`}>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white gap-2">
              <Crown className="w-4 h-4" /> Upgrade ke PRO
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset supaya file yang sama bisa dipilih lagi
    if (!file) return;

    // Validasi client tetap dipertahankan untuk UX cepat (langsung kasih
    // tahu sebelum upload jalan) — validasi yang sebenarnya tetap di server
    // (route handler /api/store/branding/upload), jadi tidak bisa dilewati begitu saja.
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast({ title: 'Format tidak didukung', description: 'Gunakan JPG, PNG, atau WebP.', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      toast({
        title: 'File terlalu besar',
        description: 'Ukuran logo maksimal 1MB. Kompres di tinypng.com atau squoosh.app.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.set('storeId', storeId);
      formData.set('logo', file);

      const res    = await fetch('/api/store/branding/upload', { method: 'POST', body: formData });
      const result = await res.json();

      if (!res.ok || !result.success) {
        toast({ title: 'Gagal', description: result.error ?? 'Terjadi kesalahan.', variant: 'destructive' });
        return;
      }
      setLogoUrl(result.logoUrl);
      toast({ title: 'Logo berhasil disimpan' });
    } catch {
      toast({ title: 'Gagal menyimpan logo', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setRemoving(true);
    try {
      const result = await removeStoreLogoAction();
      if (!result.success) {
        toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
        return;
      }
      setLogoUrl(null);
      toast({ title: 'Logo berhasil dihapus' });
    } catch {
      toast({ title: 'Gagal menghapus logo', variant: 'destructive' });
    } finally {
      setRemoving(false);
    }
  };

  const busy = uploading || removing || loadingInitial;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="w-5 h-5 text-[#028697]" /> Custom Branding
        </CardTitle>
        <CardDescription>Upload logo toko kamu — tampil di aplikasi kasir dan header</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Preview area */}
        <div className="flex items-start gap-5">
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0 relative">
            {uploading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
                <Loader2 className="w-5 h-5 text-[#028697] animate-spin" />
              </div>
            )}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo toko"
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <div className="text-center">
                <ImageIcon className="w-6 h-6 text-gray-300 mx-auto" />
                <p className="text-[10px] text-gray-400 mt-1">Belum ada logo</p>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-sm font-medium text-gray-700">{storeName}</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Format: JPG, PNG, atau WebP<br />
              Ukuran maks: 1MB<br />
              Rekomendasi: persegi (1:1), min. 200×200px
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="gap-1.5 text-xs"
              >
                {uploading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Mengunggah...</>
                  : <><Upload className="w-3.5 h-3.5" />{logoUrl ? 'Ganti Logo' : 'Upload Logo'}</>
                }
              </Button>
              {logoUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveLogo}
                  disabled={busy}
                  className="gap-1.5 text-xs text-red-500 border-red-200 hover:bg-red-50"
                >
                  {removing
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <X className="w-3.5 h-3.5" />
                  }
                  Hapus
                </Button>
              )}
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={busy}
          className="hidden"
        />

        <p className="text-xs text-gray-400">
          Logo terlalu besar? Kompres gratis di{' '}
          <a href="https://tinypng.com" target="_blank" rel="noopener noreferrer" className="text-[#028697] hover:underline">
            tinypng.com
          </a>{' '}
          atau{' '}
          <a href="https://squoosh.app" target="_blank" rel="noopener noreferrer" className="text-[#028697] hover:underline">
            squoosh.app
          </a>
        </p>

      </CardContent>
    </Card>
  );
}
