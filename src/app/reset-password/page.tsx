'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resetPasswordAction } from '@/actions/password-reset-actions';
import { Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token         = searchParams.get('token') ?? '';

  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [loading, setLoading]                 = useState(false);
  const [done, setDone]                       = useState(false);

  if (!token) {
    return (
      <Card>
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link tidak valid</h1>
          <p className="text-gray-500 text-sm">Pastikan kamu membuka link lengkap dari email reset password.</p>
        </div>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <div className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Password berhasil diubah</h1>
          <p className="text-gray-500 text-sm mb-4">Silakan login dengan password baru kamu.</p>
          <Link href="/login" className="inline-block h-11 leading-[44px] px-6 rounded-lg bg-[#028697] text-white text-sm font-semibold hover:bg-[#0fa8be]">
            Ke Halaman Login
          </Link>
        </div>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Password tidak cocok'); return;
    }
    if (password.length < 8) {
      setError('Password minimal 8 karakter'); return;
    }

    setLoading(true);
    const result = await resetPasswordAction(token, password);

    if (result.success) {
      setDone(true);
    } else {
      setError(result.error || 'Gagal reset password. Silakan coba lagi.');
      setLoading(false);
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-bold text-center text-[#028697] mb-1">Buat Password Baru</h1>
      <p className="text-sm text-gray-500 text-center mb-6">Masukkan password baru untuk akun kamu.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-gray-400" /> Password Baru
          </label>
          <div className="relative">
            <input
              id="password" type={showPassword ? 'text' : 'password'} required minLength={8}
              placeholder="Min. 8 karakter, ada angka/simbol" value={password}
              onChange={(e) => setPassword(e.target.value)} disabled={loading}
              className="w-full h-11 text-sm rounded-lg border border-input px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-[#a8f0f8]"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" disabled={loading}>
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-gray-400" /> Konfirmasi Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword" type={showConfirm ? 'text' : 'password'} required minLength={8}
              placeholder="Ulangi password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading}
              className="w-full h-11 text-sm rounded-lg border border-input px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-[#a8f0f8]"
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" disabled={loading}>
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {confirmPassword && password !== confirmPassword && (
          <p className="text-xs text-red-500">Password tidak cocok</p>
        )}

        {error && (
          <p className="text-red-600 text-sm text-center bg-red-50 rounded-lg p-3">{error}</p>
        )}

        <button
          type="submit" disabled={loading}
          className="w-full h-11 text-sm font-semibold rounded-lg bg-[#028697] text-white hover:bg-[#0fa8be]
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Menyimpan…' : 'Simpan Password Baru'}
        </button>
      </form>

      <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-[#028697] mt-5">
        <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Login
      </Link>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e0f9fc] via-[#f0fdfe] to-[#d6f7fa] p-4">
      <div className="w-full max-w-sm bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-4">
          <div className="mx-auto w-16 h-16 flex items-center justify-center">
            <Image src="/icon-512x512.png" alt="Catat Bisnisku" width={64} height={64} className="rounded-2xl shadow-lg" priority />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e0f9fc] via-[#f0fdfe] to-[#d6f7fa]">
        <div className="w-8 h-8 border-4 border-[#a8f0f8] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
