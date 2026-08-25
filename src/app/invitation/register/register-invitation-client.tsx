'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerFromInvitationAction } from '@/actions/team-actions';
import { Eye, EyeOff, Lock, User } from 'lucide-react';

type Status = 'pending' | 'not-found' | 'expired' | 'accepted' | 'declined';

interface Props {
  status:        Status;
  token?:        string;
  email?:        string;
  storeName?:    string;
  storeLogoUrl?: string;
  inviterName?:  string;
  role?:         string;
}

export default function RegisterInvitationClient({
  status, token, email, storeName, storeLogoUrl, inviterName, role,
}: Props) {
  const router = useRouter();
  const [name, setName]                 = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);

  if (status === 'not-found') {
    return (
      <Layout>
        <StatusMessage emoji="🔍" title="Undangan tidak ditemukan" desc="Link undangan tidak valid atau sudah digunakan." />
      </Layout>
    );
  }
  if (status === 'expired') {
    return (
      <Layout>
        <StatusMessage emoji="⏰" title="Undangan kedaluwarsa" desc="Minta pemilik toko untuk mengirim ulang undangan." />
      </Layout>
    );
  }
  if (status === 'accepted' || status === 'declined') {
    return (
      <Layout>
        <StatusMessage
          emoji={status === 'accepted' ? '✅' : '👋'}
          title={status === 'accepted' ? 'Undangan sudah diterima' : 'Undangan sudah ditolak'}
          desc={status === 'accepted' ? 'Silakan login untuk masuk ke dasbor toko.' : 'Kamu bisa menutup halaman ini.'}
        />
      </Layout>
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
    if (!token) return;

    setLoading(true);
    const formData = new FormData();
    formData.set('name', name);
    formData.set('password', password);

    const result = await registerFromInvitationAction(token, formData);

    if (result.success) {
      router.push(`/login?registered=true&invited=true&slug=${result.storeSlug ?? ''}`);
    } else {
      setError(result.error || 'Registrasi gagal. Silakan coba lagi.');
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="text-center mb-6">
        {storeLogoUrl ? (
          <img src={storeLogoUrl} alt={storeName} className="w-16 h-16 rounded-xl mx-auto mb-3 object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-teal-100 flex items-center justify-center mx-auto mb-3 text-2xl">
            🏪
          </div>
        )}
        <h1 className="text-xl font-semibold text-gray-900">{storeName}</h1>
        <p className="text-gray-500 text-sm mt-1">
          <strong>{inviterName}</strong> mengundang kamu sebagai <strong>{role}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Email</label>
          <input
            type="text" value={email} disabled
            className="w-full h-11 text-sm rounded-lg border border-gray-200 bg-gray-50 text-gray-500 px-3"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="name" className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-gray-400" /> Nama Lengkap
          </label>
          <input
            id="name" type="text" required placeholder="Nama lengkap"
            value={name} onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className="w-full h-11 text-sm rounded-lg border border-input px-3 focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-gray-400" /> Password
            </label>
            <div className="relative">
              <input
                id="password" type={showPassword ? 'text' : 'password'} required minLength={8}
                placeholder="Min. 8 karakter" value={password}
                onChange={(e) => setPassword(e.target.value)} disabled={loading}
                className="w-full h-11 text-sm rounded-lg border border-input px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-teal-200"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" disabled={loading}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-gray-400" /> Konfirmasi
            </label>
            <div className="relative">
              <input
                id="confirmPassword" type={showConfirm ? 'text' : 'password'} required minLength={8}
                placeholder="Ulangi password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading}
                className="w-full h-11 text-sm rounded-lg border border-input px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-teal-200"
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" disabled={loading}>
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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
          className="w-full h-11 text-sm font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Membuat akun…' : 'Buat Akun & Gabung Tim'}
        </button>
      </form>
    </Layout>
  );
}

function StatusMessage({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="text-5xl mb-4">{emoji}</div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500 text-sm">{desc}</p>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="text-sm font-semibold text-teal-700">CatatBisnisku</span>
        </div>
        {children}
      </div>
    </div>
  );
}
