'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { registerMemberAction } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import {
  UserPlus, User, Phone, Mail, Calendar,
  Lock, ArrowLeft, Sparkles, ChevronDown, Eye, EyeOff, Notebook,
} from 'lucide-react';
import Image from 'next/image';

function RegisterForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [storeId, setStoreId]           = useState('');
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);

  useEffect(() => {
    const sid = searchParams.get('storeId');
    if (sid) setStoreId(sid);
  }, [searchParams]);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [phone, setPhone]   = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Birthday
  const [birthYear, setBirthYear]   = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay]     = useState('');

  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const today       = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay   = today.getDate();
  const years        = Array.from({ length: 100 }, (_, i) => currentYear - i);

  const availableMonths = months.filter((_, i) => {
    if (Number(birthYear) < currentYear) return true;
    return i + 1 <= currentMonth;
  });

  const getDaysInMonth = (month: string, year: string) => {
    if (!month) return 31;
    return new Date(Number(year) || 2000, Number(month), 0).getDate();
  };
  const maxDay = (() => {
    const total = getDaysInMonth(birthMonth, birthYear);
    if (Number(birthYear) === currentYear && Number(birthMonth) === currentMonth) {
      return Math.min(currentDay - 1, total);
    }
    return total;
  })();
  const days          = Array.from({ length: maxDay }, (_, i) => i + 1);
  const monthUnlocked = !!birthYear;
  const dayUnlocked   = !!birthYear && !!birthMonth;
  const birthdayValue = birthYear && birthMonth && birthDay
    ? `${birthYear}-${birthMonth.padStart(2,'0')}-${birthDay.padStart(2,'0')}`
    : '';

  const selectClass = (unlocked: boolean, filled: boolean) =>
    ['w-full h-11 text-sm rounded-md border px-3 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-[#a8f0f8] transition-all duration-200',
      !unlocked ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
      : !filled  ? 'border-[#a8f0f8] bg-[#e0f9fc] text-[#0fa8be] cursor-pointer'
      :            'border-input bg-background text-gray-700 cursor-pointer',
    ].join(' ');

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Password tidak cocok'); return;
    }
    if (password.length < 8) {
      setError('Password minimal 8 karakter'); return;
    }
    if (!birthdayValue) {
      setError('Tanggal lahir wajib diisi'); return;
    }
    if (new Date(birthdayValue) >= new Date(new Date().toDateString())) {
      setError('Tanggal lahir tidak boleh hari ini atau di masa depan'); return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set('birthday', birthdayValue);
    if (storeId) formData.set('storeId', storeId);

    const result = await registerMemberAction(formData);

    if (result.success) {
      if ((result as any).needsVerification) {
        router.push('/login?registered=true&verify=true');
      } else {
        const slug = searchParams.get('slug') ?? '';
        router.push(slug ? `/login?registered=true&slug=${slug}` : '/login?registered=true');
      }
    } else {
      setError(result.error || 'Registrasi gagal. Silakan coba lagi.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e0f9fc] via-[#f0fdfe] to-[#d6f7fa] p-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#a8f0f8] rounded-full mix-blend-multiply filter blur-xl opacity-15" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#0fa8be] rounded-full mix-blend-multiply filter blur-xl opacity-15" />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-0 relative z-10 backdrop-blur-sm bg-white/95">
        <CardHeader className="space-y-3 pb-6">
          <div className="mx-auto w-16 h-16 flex items-center justify-center">
            <Image src="/icon-512x512.png" alt="Catat Bisnisku" width={64} height={64} className="rounded-2xl shadow-lg" priority />
          </div>
          <CardTitle className="text-2xl font-bold text-center text-[#028697]">Daftar Member</CardTitle>
          <CardDescription className="text-center text-sm">
            Buat akun dan dapatkan poin setiap kali belanja
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="p-4 bg-[#e0f9fc] rounded-lg border border-[#a8f0f8]">
            <p className="font-semibold mb-2 text-xs text-gray-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0fa8be]" /> Keuntungan Member:
            </p>
            <ul className="space-y-1 text-xs text-gray-600">
              <li>✨ Dapatkan poin setiap pembelian</li>
              <li>🎁 Hadiah ulang tahun eksklusif</li>
              <li>💰 Tukar poin untuk potongan harga</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Nama */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-gray-400" /> Nama Lengkap <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name" name="name" type="text" required
                placeholder="Nama lengkap" value={name}
                onChange={(e) => setName(e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()))}
                disabled={loading} maxLength={80}
                className="h-11 text-sm focus-visible:ring-[#a8f0f8]"
              />
            </div>

            {/* Email — required, primary identifier */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-gray-400" /> Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email" name="email" type="email" required
                placeholder="kamu@email.com" value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                disabled={loading}
                className="h-11 text-sm focus-visible:ring-[#a8f0f8]"
              />
              <p className="text-xs text-gray-400">Dipakai untuk login dan verifikasi akun</p>
            </div>

            {/* No. HP — opsional */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-medium flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                No. WhatsApp <span className="text-gray-400 font-normal">(opsional)</span>
              </Label>
              <Input
                id="phone" name="phone" type="tel"
                placeholder="08123456789" value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\-\s()]/g, ''))}
                disabled={loading} maxLength={20}
                className="h-11 text-sm focus-visible:ring-[#a8f0f8]"
              />
            </div>

            {/* Tanggal Lahir */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-gray-400" /> Tanggal Lahir <span className="text-red-500">*</span>
              </Label>
              <input type="hidden" name="birthday" value={birthdayValue} />
              <div className="flex gap-1 mb-1">
                {[!!birthYear, !!birthMonth, !!birthDay].map((done, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all ${done ? 'bg-[#0fa8be]' : 'bg-gray-200'}`} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">① Tahun</p>
                  <div className="relative">
                    <select value={birthYear} onChange={(e) => { setBirthYear(e.target.value); setBirthMonth(''); setBirthDay(''); }}
                      disabled={loading} className={selectClass(true, !!birthYear)}>
                      <option value="">--</option>
                      {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className={`text-xs font-medium ${monthUnlocked ? 'text-[#0fa8be]' : 'text-gray-300'}`}>② Bulan</p>
                  <div className="relative">
                    <select value={birthMonth}
                      onChange={(e) => { setBirthMonth(e.target.value); if (Number(birthDay) > getDaysInMonth(e.target.value, birthYear)) setBirthDay(''); }}
                      disabled={loading || !monthUnlocked} className={selectClass(monthUnlocked, !!birthMonth)}>
                      <option value="">{monthUnlocked ? 'Pilih' : '--'}</option>
                      {availableMonths.map((m) => <option key={m} value={String(months.indexOf(m) + 1)}>{m}</option>)}
                    </select>
                    <ChevronDown className={`w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${monthUnlocked ? 'text-gray-400' : 'text-gray-200'}`} />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className={`text-xs font-medium ${dayUnlocked ? 'text-[#0fa8be]' : 'text-gray-300'}`}>③ Tanggal</p>
                  <div className="relative">
                    <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)}
                      disabled={loading || !dayUnlocked} className={selectClass(dayUnlocked, !!birthDay)}>
                      <option value="">{dayUnlocked ? 'Pilih' : '--'}</option>
                      {days.map((d) => <option key={d} value={String(d)}>{d}</option>)}
                    </select>
                    <ChevronDown className={`w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${dayUnlocked ? 'text-gray-400' : 'text-gray-200'}`} />
                  </div>
                </div>
              </div>
              {birthdayValue && (
                <p className="text-xs text-green-600 font-medium">
                  ✓ {birthDay} {months[Number(birthMonth) - 1]} {birthYear}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-gray-400" /> Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input id="password" name="password" type={showPassword ? 'text' : 'password'}
                    required minLength={8} placeholder="Min. 8 karakter"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    disabled={loading} className="h-11 text-sm pr-10 focus-visible:ring-[#a8f0f8]"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" disabled={loading}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-medium flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-gray-400" /> Konfirmasi <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input id="confirmPassword" name="confirmPassword" type={showConfirm ? 'text' : 'password'}
                    required minLength={8} placeholder="Ulangi password"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading} className="h-11 text-sm pr-10 focus-visible:ring-[#a8f0f8]"
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
            {confirmPassword && password === confirmPassword && password.length >= 8 && (
              <p className="text-xs text-green-600">Password cocok ✓</p>
            )}

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">{error}</div>
            )}

            <Button type="submit" disabled={loading}
              className="w-full h-11 text-sm font-semibold bg-[#028697] hover:bg-[#0fa8be] text-white shadow-lg">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Mendaftarkan...</>
                : <><UserPlus className="w-4 h-4 mr-2" />Daftar Member</>
              }
            </Button>
          </form>

          <div className="flex flex-col gap-2 pt-1">
            <Link href="/login">
              <Button variant="outline" className="w-full h-10 text-sm border-2 border-[#028697] text-[#028697] hover:bg-[#e0f9fc]">
                <ArrowLeft className="w-4 h-4 mr-2" /> Sudah punya akun? Login
              </Button>
            </Link>
            <Link href="/catalog">
              <Button variant="ghost" className="w-full h-8 text-xs text-gray-400 hover:text-[#028697] underline">
                <Notebook className="w-3 h-3 mr-1" /> Lihat produk
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e0f9fc] via-[#f0fdfe] to-[#d6f7fa]">
        <div className="w-8 h-8 border-4 border-[#a8f0f8] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
