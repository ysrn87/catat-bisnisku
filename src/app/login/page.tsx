'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginAction } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { LogIn, Mail, Lock, Sparkles, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

function isSafeRedirect(url: string | null): url is string {
  // Cegah open-redirect: hanya izinkan path relatif ("/xxx"), bukan
  // "//evil.com" (protocol-relative) atau URL absolut ("https://evil.com").
  return !!url && url.startsWith('/') && !url.startsWith('//') && !/^\/\\/.test(url) && !url.includes('://');
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError]              = useState<string | null>(null);
  const [loading, setLoading]          = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newStoreSlug, setNewStoreSlug] = useState<string | null>(null);

  useEffect(() => {
    const registered = searchParams.get('registered');
    const slug       = searchParams.get('slug');

    if (registered === 'true') {
      const verify  = searchParams.get('verify');
      const invited = searchParams.get('invited');
      if (verify === 'true') {
        setSuccessMessage('Akun berhasil dibuat! Cek email kamu untuk verifikasi sebelum login.');
      } else if (invited === 'true') {
        setSuccessMessage('Undangan diterima! Login untuk masuk ke dasbor toko kamu.');
      } else if (slug) {
        setNewStoreSlug(slug);
        setSuccessMessage('Toko berhasil dibuat! Login untuk masuk ke dasbor toko kamu.');
      } else {
        setSuccessMessage('Akun berhasil dibuat! Silakan login.');
      }
    }
    const verified = searchParams.get('verified');
    if (verified === '1') {
      setSuccessMessage('Email berhasil diverifikasi! Silakan login.');
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData(e.currentTarget);
    const result   = await loginAction(formData);

    if (result.success) {
      const callbackUrl = searchParams.get('callbackUrl');
      router.push(isSafeRedirect(callbackUrl) ? callbackUrl : '/store-select');
      router.refresh();
    } else {
      setError(result.error || 'Email atau password salah.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e0f9fc] via-[#f0fdfe] to-[#d6f7fa] p-4">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#a8f0f8] rounded-full mix-blend-multiply filter blur-xl opacity-15" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#0fa8be] rounded-full mix-blend-multiply filter blur-xl opacity-15" />
      </div>

      <Card className="w-3/4 max-w-md shadow-2xl relative z-10 backdrop-blur-lg bg-white/95">
        <CardHeader className="space-y-3 pb-6">
          <div className="mx-auto w-16 h-16 flex items-center justify-center">
            <Image src="/icon-512x512.png" alt="Catat Bisnisku" width={64} height={64} className="rounded-2xl shadow-lg" priority />
          </div>
          <CardTitle className="text-xl font-bold text-center text-[#028697]">
            Catat Bisnisku
          </CardTitle>
          <CardDescription className="text-center text-base">
            Login untuk akses ke toko kamu
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Success banner setelah register store */}
          {successMessage && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-lg space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
              {newStoreSlug && (
                <p className="text-xs text-green-600 pl-6">
                  URL toko: <span className="font-mono font-semibold">/{newStoreSlug}</span>
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-xs font-light flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-500" />
                Email
              </Label>
              <Input
                id="identifier" name="identifier" type="email" required
                placeholder="you@example.com"
                disabled={loading}
                className="h-11 text-sm focus-visible:ring-[#a8f0f8]"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-light flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-500" />
                  Password
                </Label>
                <Link href="/forgot-password" className="text-xs text-[#028697] hover:underline">
                  Lupa password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password" name="password"
                  type={showPassword ? 'text' : 'password'}
                  required placeholder="••••••••"
                  disabled={loading}
                  className="h-11 text-sm pr-10 focus-visible:ring-[#a8f0f8]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold bg-[#028697] hover:bg-[#0fa8be] text-white transition-all duration-200 shadow-lg"
              disabled={loading}
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Masuk...</>
              ) : (
                <><LogIn className="w-4 h-4 mr-2" /> Masuk</>
              )}
            </Button>
          </form>

          <div className="text-center text-xs text-gray-500">
            Belum punya toko?{' '}
            <Link href="/register-store" className="text-[#028697] hover:underline font-medium">
              Daftar toko baru
            </Link>
          </div>

          <div className="text-center">
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Kembali ke ringkasan
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e0f9fc] via-[#f0fdfe] to-[#d6f7fa]">
        <Card className="w-full max-w-md shadow-2xl border-0">
          <CardContent className="p-6 text-center flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-[#a8f0f8] border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600">Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
