'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Crown, Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { updateStoreBrandingAction, getStoreBranding } from '@/actions/settings';
import Link from 'next/link';

interface BrandingTabProps {
  storeSlug: string;
  storePlan: 'FREE' | 'PRO';
}

/**
 * Tab branding di halaman settings — PRO only.
 * Memungkinkan upload logo toko dalam format JPG/PNG/WebP max 100KB.
 */
export function BrandingTab({ storeSlug, storePlan }: BrandingTabProps) {
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [storeName, setStoreName]     = useState('');
  const [loading, setLoading]         = useState(false);
  const [isDirty, setIsDirty]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast }    = useToast();

  useEffect(() => {
    getStoreBranding().then(({ logoUrl, storeName }) => {
      setLogoPreview(logoUrl);
      setStoreName(storeName);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validasi tipe
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({ title: 'Format tidak didukung', description: 'Gunakan JPG, PNG, atau WebP.', variant: 'destructive' });
      return;
    }

    // Validasi ukuran (100KB)
    if (file.size > 100 * 1024) {
      toast({
        title: 'File terlalu besar',
        description: 'Ukuran logo maksimal 100KB. Kompres di tinypng.com atau squoosh.app.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
      setIsDirty(true);
    };
    reader.readAsDataURL(file);

    // Reset input supaya file yang sama bisa dipilih lagi
    e.target.value = '';
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setIsDirty(true);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await updateStoreBrandingAction(logoPreview);
      if (!result.success) {
        toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: logoPreview ? 'Logo berhasil disimpan' : 'Logo berhasil dihapus' });
      setIsDirty(false);
    } catch {
      toast({ title: 'Gagal menyimpan', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

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
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
            {logoPreview ? (
              <img
                src={logoPreview}
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
              Ukuran maks: 100KB<br />
              Rekomendasi: persegi (1:1), min. 200×200px
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 text-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                {logoPreview ? 'Ganti Logo' : 'Upload Logo'}
              </Button>
              {logoPreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveLogo}
                  className="gap-1.5 text-xs text-red-500 border-red-200 hover:bg-red-50"
                >
                  <X className="w-3.5 h-3.5" /> Hapus
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

        <div className="flex justify-end pt-1">
          <Button
            onClick={handleSave}
            disabled={loading || !isDirty}
            className="bg-[#028697] hover:bg-[#17a8bb]"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menyimpan...</>
              : 'Simpan Logo'
            }
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}
