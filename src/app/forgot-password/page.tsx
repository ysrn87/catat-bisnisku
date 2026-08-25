'use client';

import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordResetAction } from '@/actions/password-reset-actions';
import { Mail, ArrowLeft, MailCheck } from 'lucide-react';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    await requestPasswordResetAction(email);
    // Selalu tampilkan pesan sukses yang sama, terlepas dari email itu
    // terdaftar atau tidak — supaya halaman ini tidak bisa dipakai untuk
    // mengecek email mana yang punya akun.
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e0f9fc] via-[#f0fdfe] to-[#d6f7fa] p-4">
      <div className="w-full max-w-sm bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 flex items-center justify-center mb-3">
            <Image src="/icon-512x512.png" alt="Catat Bisnisku" width={64} height={64} className="rounded-2xl shadow-lg" priority />
          </div>
          <h1 className="text-xl font-bold text-[#028697]">Lupa Password</h1>
        </div>

        {sent ? (
          <div className="text-center space-y-3">
            <MailCheck className="w-10 h-10 text-[#028697] mx-auto" />
            <p className="text-sm text-gray-600">
              Kalau <strong>{email}</strong> terdaftar, kami sudah mengirim link
              reset password ke email tersebut. Cek juga folder spam.
            </p>
            <Link href="/login" className="inline-block text-sm text-[#028697] hover:underline mt-2">
              Kembali ke Login
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 text-center mb-6">
              Masukkan email akun kamu. Kami akan kirim link untuk membuat password baru.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" /> Email
                </label>
                <input
                  id="email" name="email" type="email" required
                  placeholder="nama@email.com" value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  disabled={loading}
                  className="w-full h-11 text-sm rounded-lg border border-input px-3 focus:outline-none focus:ring-2 focus:ring-[#a8f0f8]"
                />
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full h-11 text-sm font-semibold rounded-lg bg-[#028697] text-white hover:bg-[#0fa8be]
                  disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Mengirim…' : 'Kirim Link Reset'}
              </button>
            </form>

            <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-[#028697] mt-5">
              <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
