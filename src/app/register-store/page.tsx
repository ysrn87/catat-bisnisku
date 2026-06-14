'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { registerStoreAction, checkSlugAvailability } from '@/actions/register-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import {
  Store, User, Phone, Mail, Lock, Eye, EyeOff,
  CheckCircle2, XCircle, ArrowRight, ArrowLeft,
  Loader2, Check, AlertCircle,
} from 'lucide-react';
import Image from 'next/image';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function RegisterStorePage() {
  const router = useRouter();
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Store fields
  const [storeName, setStoreName] = useState('');
  const [storeSlug, setStoreSlug] = useState('');
  const [slugManual, setSlugManual]   = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);

  // Owner fields
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  // Auto-generate slug dari nama toko
  useEffect(() => {
    if (!slugManual && storeName) {
      setStoreSlug(slugify(storeName));
    }
  }, [storeName, slugManual]);

  // Debounce cek ketersediaan slug
  const checkSlug = useCallback(async (slug: string) => {
    if (!slug || slug.length < 3) { setSlugAvailable(null); return; }
    setSlugChecking(true);
    const { available } = await checkSlugAvailability(slug);
    setSlugAvailable(available);
    setSlugChecking(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => checkSlug(storeSlug), 500);
    return () => clearTimeout(timer);
  }, [storeSlug, checkSlug]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await registerStoreAction(formData);

    if (result.success && result.slug) {
      router.push(`/login?registered=true&slug=${result.slug}`);
    } else {
      setError(result.error || 'Terjadi kesalahan. Silakan coba lagi.');
      setLoading(false);
    }
  }

  const slugStatus = () => {
    if (!storeSlug || storeSlug.length < 3) return null;
    if (slugChecking) return <span className="flex items-center gap-1 text-gray-400 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Mengecek...</span>;
    if (slugAvailable === true)  return <span className="flex items-center gap-1 text-green-600 text-xs"><Check className="w-3 h-3" /> Tersedia</span>;
    if (slugAvailable === false) return <span className="flex items-center gap-1 text-red-500 text-xs"><AlertCircle className="w-3 h-3" /> Sudah digunakan</span>;
    return null;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e0f5f2] via-[#f0faf8] to-[#d0f0eb] p-4 py-12">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#2bbfb0] rounded-full mix-blend-multiply filter blur-xl opacity-15" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#00a090] rounded-full mix-blend-multiply filter blur-xl opacity-15" />
      </div>

      <Card className="w-full max-w-lg shadow-2xl border-0 relative z-10 bg-white/95 backdrop-blur-sm">
        <CardHeader className="space-y-3 pb-4">
          <div className="mx-auto w-14 h-14 flex items-center justify-center">
            <Image src="/icon-512x512.png" alt="Catat Bisnisku" width={56} height={56} className="rounded-2xl shadow-lg" priority />
          </div>
          <CardTitle className="text-2xl font-bold text-center text-[#00a090]">Buat Toko Baru</CardTitle>
          <CardDescription className="text-center text-sm">
            Isi detail toko dan akun pemilik untuk memulai
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* ── SECTION: Info Toko ── */}
            <div className="space-y-1 pb-1 border-b border-gray-100">
              <p className="text-xs font-semibold text-[#00a090] uppercase tracking-wide flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" /> Informasi Toko
              </p>
            </div>

            {/* Nama Toko */}
            <div className="space-y-1.5">
              <Label htmlFor="storeName" className="text-xs font-medium">
                Nama Toko <span className="text-red-500">*</span>
              </Label>
              <Input
                id="storeName" name="storeName" type="text" required
                placeholder="Contoh: Warung Bu Sari, Toko Berkah"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                disabled={loading} maxLength={80}
                className="h-10 text-sm focus-visible:ring-[#2bbfb0]"
              />
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <Label htmlFor="storeSlug" className="text-xs font-medium">
                URL Toko <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 whitespace-nowrap">catatbisnisku.com/</span>
                <div className="relative flex-1">
                  <Input
                    id="storeSlug" name="storeSlug" type="text" required
                    placeholder="nama-toko"
                    value={storeSlug}
                    onChange={(e) => { setSlugManual(true); setStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); }}
                    disabled={loading} minLength={3} maxLength={50}
                    className="h-10 text-sm focus-visible:ring-[#2bbfb0] pr-24"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">{slugStatus()}</div>
                </div>
              </div>
              <p className="text-xs text-gray-400">Hanya huruf kecil, angka, dan tanda hubung (-). Tidak bisa diubah nanti.</p>
            </div>

            {/* ── SECTION: Info Pemilik ── */}
            <div className="space-y-1 pb-1 pt-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-[#00a090] uppercase tracking-wide flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Akun Pemilik
              </p>
            </div>

            {/* Nama Pemilik */}
            <div className="space-y-1.5">
              <Label htmlFor="ownerName" className="text-xs font-medium">
                Nama Lengkap <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ownerName" name="ownerName" type="text" required
                placeholder="Nama lengkap pemilik"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                disabled={loading} maxLength={80}
                className="h-10 text-sm focus-visible:ring-[#2bbfb0]"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="ownerPhone" className="text-xs font-medium flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                Nomor WhatsApp <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ownerPhone" name="ownerPhone" type="tel" required
                placeholder="08123456789"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value.replace(/[^0-9+\-\s()]/g, ''))}
                disabled={loading} minLength={9} maxLength={20}
                className="h-10 text-sm focus-visible:ring-[#2bbfb0]"
              />
              <p className="text-xs text-gray-400">Digunakan untuk login</p>
            </div>

            {/* Email (opsional) */}
            <div className="space-y-1.5">
              <Label htmlFor="ownerEmail" className="text-xs font-medium flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                Email <span className="text-gray-400 font-normal">(opsional)</span>
              </Label>
              <Input
                id="ownerEmail" name="ownerEmail" type="email"
                placeholder="pemilik@email.com"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                disabled={loading}
                className="h-10 text-sm focus-visible:ring-[#2bbfb0]"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="ownerPassword" className="text-xs font-medium flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-gray-400" />
                Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="ownerPassword" name="ownerPassword"
                  type={showPassword ? 'text' : 'password'}
                  required placeholder="Min. 6 karakter"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  disabled={loading} minLength={6}
                  className="h-10 text-sm pr-10 focus-visible:ring-[#2bbfb0]"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Plan info */}
            <div className="p-3 bg-[#e0f5f2] rounded-lg border border-[#90e0d8] text-xs text-gray-600 space-y-1.5">
              <p className="font-semibold text-[#00a090]">Plan FREE — Gratis selamanya</p>
              <div className="grid grid-cols-2 gap-1">
                {['Hingga 50 produk', 'Hingga 2 Manager', 'Kasir & Penjualan', 'Sistem Poin Member'].map((f) => (
                  <span key={f} className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-[#00a090] flex-shrink-0" /> {f}
                  </span>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || slugAvailable === false || slugChecking}
              className="w-full h-11 text-sm font-semibold bg-[#00a090] hover:bg-[#007060] text-white shadow-lg"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat toko...</>
              ) : (
                <>Buat Toko Sekarang <ArrowRight className="ml-2 w-4 h-4" /></>
              )}
            </Button>

            <div className="text-center text-xs text-gray-500 pt-1">
              Sudah punya akun?{' '}
              <Link href="/login" className="text-[#00a090] hover:underline font-medium">
                Masuk di sini
              </Link>
            </div>

            <div className="text-center">
              <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Kembali ke beranda
              </Link>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
