'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { registerMemberAction } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { UserPlus, User, Phone, Mail, MapPin, Calendar, Lock, ArrowLeft, Sparkles, ChevronDown, Eye, EyeOff, Notebook } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [storeId, setStoreId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sid = searchParams.get('storeId');
    if (sid) setStoreId(sid);
  }, [searchParams]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (storeId) formData.set('storeId', storeId);
    setLoading(true);
    setError(null);

    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const birthday = formData.get('birthday') as string;
    if (!birthday) {
      setError('Tanggal lahir wajib diisi');
      setLoading(false);
      return;
    }
    if (new Date(birthday) >= new Date(new Date().toDateString())) {
      setError('Tanggal lahir tidak boleh hari ini atau di masa depan');
      setLoading(false);
      return;
    }

    const result = await registerMemberAction(formData);

    if (result.success) {
      const slug = searchParams.get('slug') ?? '';
      router.push(slug ? `/login?registered=true&slug=${slug}` : '/login?registered=true');
    } else {
      setError(result.error || 'Registration failed');
      setLoading(false);
    }
  }

  const [name, setName] = useState('');
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()));
  };

  const [phone, setPhone] = useState('');
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9+]/g, '');
    setPhone(raw.replace(/(.{4})/g, '$1 ').trim());
  };

  const [emailError, setEmailError] = useState('');
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    setEmailError(val && !valid ? 'Masukkan alamat email yang valid' : '');
  };

  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  const availableMonths = months.filter((_, i) => {
    if (Number(birthYear) < currentYear) return true;
    return i + 1 <= currentMonth;
  });

  const getDaysInMonth = (month: string, year: string) => {
    if (!month) return 31;
    return new Date(Number(year) || 2000, Number(month), 0).getDate();
  };

  const maxDay = (() => {
    const totalDays = getDaysInMonth(birthMonth, birthYear);
    if (Number(birthYear) === currentYear && Number(birthMonth) === currentMonth) {
      return Math.min(currentDay - 1, totalDays);
    }
    return totalDays;
  })();

  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  const monthUnlocked = !!birthYear;
  const dayUnlocked = !!birthYear && !!birthMonth;

  const birthdayValue =
    birthYear && birthMonth && birthDay
      ? `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
      : '';

  const [address, setAddress] = useState('');

  const selectClass = (unlocked: boolean, filled: boolean) =>
    [
      'w-full h-11 text-sm rounded-md border px-3 pr-8 appearance-none',
      'focus:outline-none focus:ring-2 focus:ring-[#1ecbe1] transition-all duration-200',
      !unlocked
        ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
        : !filled
          ? 'border-[#1ecbe1] bg-[#e0f9fc] text-[#0fa8be] cursor-pointer'
          : 'border-input bg-background text-gray-700 cursor-pointer',
    ].join(' ');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e0f9fc] via-[#f0fdfe] to-[#d6f7fa] p-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#1ecbe1] rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#17a8bb] rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#0fa8be] rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-4000" />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-0 relative z-10 backdrop-blur-sm bg-white/95">
        <CardHeader className="space-y-3 pb-6">
          <div className="mx-auto w-16 h-16 flex items-center justify-center">
            <Image
              src="/icon-512x512.png"
              alt="Catat Bisnisku"
              width={64}
              height={64}
              className="rounded-2xl shadow-lg"
            />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-center text-[#028697]">
            Daftar Member
          </CardTitle>
          <CardDescription className="text-center text-sm">
            Buat akun sekarang dan dapatkan poin setiap kali melakukan pembelian
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Benefits Banner */}
          <div className="p-4 bg-[#e0f9fc] rounded-lg border border-[#a8f0f8]">
            <p className="font-semibold mb-2 text-xs text-gray-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#1ecbe1]" />
              Keuntungan Member:
            </p>
            <ul className="space-y-1 text-xs text-gray-600">
              <li>✨ Dapatkan poin setiap pembelian</li>
              <li>🎁 Hadiah ulang tahun eksklusif</li>
              <li>💰 Tukar poin untuk potongan harga</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                Nama Lengkap <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name" name="name" type="text" required
                placeholder="Nama Lengkap"
                value={name} onChange={handleNameChange}
                disabled={loading} maxLength={80}
                className="h-11 text-sm focus-visible:ring-[#1ecbe1]"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs font-medium flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-500" />
                WhatsApp Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone" name="phone" type="tel"
                value={phone} onChange={handlePhoneChange}
                onKeyDown={(e) => {
                  const controlKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
                  if (!controlKeys.includes(e.key) && !/^[0-9+]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                  }
                }}
                minLength={9} maxLength={19} inputMode="tel" required
                placeholder="0812 3456 7890"
                disabled={loading}
                className="h-11 text-sm focus-visible:ring-[#1ecbe1]"
              />
              <p className="text-xs text-muted-foreground">Diperlukan untuk login dan klaim poin</p>
            </div>

            {/* Birthday Picker */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                Tanggal Lahir <span className="text-red-500">*</span>
              </Label>
              <input type="hidden" name="birthday" value={birthdayValue} />

              {/* Progress bar */}
              <div className="flex gap-1 mb-1">
                {[!!birthYear, !!birthMonth, !!birthDay].map((done, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${done ? 'bg-[#1ecbe1]' : 'bg-gray-200'
                      }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 font-medium">① Tahun</p>
                  <div className="relative">
                    <select
                      value={birthYear}
                      onChange={(e) => { setBirthYear(e.target.value); setBirthMonth(''); setBirthDay(''); }}
                      disabled={loading}
                      className={selectClass(true, !!birthYear)}
                    >
                      <option value="">--</option>
                      {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className={`text-xs font-medium transition-colors duration-200 ${monthUnlocked ? 'text-[#1ecbe1]' : 'text-gray-300'}`}>
                    ② Bulan {monthUnlocked && !birthMonth && '👈'}
                  </p>
                  <div className="relative">
                    <select
                      value={birthMonth}
                      onChange={(e) => {
                        setBirthMonth(e.target.value);
                        const totalDays = new Date(Number(birthYear) || 2000, Number(e.target.value), 0).getDate();
                        const isCurrent = Number(birthYear) === currentYear && Number(e.target.value) === currentMonth;
                        const newMaxDay = isCurrent ? Math.min(currentDay - 1, totalDays) : totalDays;
                        if (Number(birthDay) > newMaxDay) setBirthDay('');
                      }}
                      disabled={loading || !monthUnlocked}
                      className={selectClass(monthUnlocked, !!birthMonth)}
                    >
                      <option value="">{monthUnlocked ? 'Pilih bulan' : '--'}</option>
                      {availableMonths.map((m) => (
                        <option key={m} value={String(months.indexOf(m) + 1)}>{m}</option>
                      ))}
                    </select>
                    <ChevronDown className={`w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${monthUnlocked ? 'text-gray-400' : 'text-gray-200'}`} />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className={`text-xs font-medium transition-colors duration-200 ${dayUnlocked ? 'text-[#1ecbe1]' : 'text-gray-300'}`}>
                    ③ Tanggal {dayUnlocked && !birthDay && '👈'}
                  </p>
                  <div className="relative">
                    <select
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                      disabled={loading || !dayUnlocked}
                      className={selectClass(dayUnlocked, !!birthDay)}
                    >
                      <option value="">{dayUnlocked ? 'Pilih tgl' : '--'}</option>
                      {days.map((d) => <option key={d} value={String(d)}>{d}</option>)}
                    </select>
                    <ChevronDown className={`w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${dayUnlocked ? 'text-gray-400' : 'text-gray-200'}`} />
                  </div>
                </div>
              </div>

              <div className="min-h-[20px]">
                {birthdayValue ? (
                  <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                    ✓ {birthDay} {months[Number(birthMonth) - 1]} {birthYear}
                  </p>
                ) : dayUnlocked && !birthDay ? (
                  <p className="text-xs text-[#1ecbe1]">Satu langkah lagi — pilih tanggal lahir</p>
                ) : monthUnlocked && !birthMonth ? (
                  <p className="text-xs text-[#1ecbe1]">Sekarang pilih bulan lahir</p>
                ) : !birthYear ? (
                  <p className="text-xs text-gray-400">Mulai dengan memilih tahun lahir</p>
                ) : null}
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address" className="text-xs font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                Alamat <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="address" name="address"
                placeholder="Nama Jalan, Kota, Kode Pos"
                value={address} required
                onChange={(e) => setAddress(e.target.value)}
                disabled={loading} maxLength={250}
                className="h-11 text-sm focus-visible:ring-[#1ecbe1]"
              />
              <p className="text-xs text-gray-500 text-right">{address.length}/250 karakter</p>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-500" />
                Email{' '}
                <span className="text-gray-400 font-normal">(Opsional — jika ingin login alternatif)</span>
              </Label>
              <Input
                id="email" name="email" type="email"
                placeholder="you@example.com"
                disabled={loading} onChange={handleEmailChange}
                pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                className="h-11 text-sm focus-visible:ring-[#1ecbe1]"
              />
              {emailError && <p className="text-xs text-red-500">{emailError}</p>}
            </div>

            {/* Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-500" />
                  Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password" name="password"
                    type={showPassword ? 'text' : 'password'}
                    required placeholder="Min. 6 characters"
                    minLength={6} disabled={loading}
                    className="h-11 text-sm pr-10 focus-visible:ring-[#1ecbe1]"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    disabled={loading}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-xs font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-500" />
                  Confirm Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword" name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required placeholder="Re-enter password"
                    minLength={6} disabled={loading}
                    className="h-11 text-sm pr-10 focus-visible:ring-[#1ecbe1]"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    disabled={loading}>
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold bg-[#028697] hover:bg-[#17a8bb] text-white transition-all duration-200 shadow-lg hover:shadow-xl"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Mendaftarkan akun...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Daftar Member
                </>
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-4 bg-white text-gray-500">Sudah menjadi member?</span>
            </div>
          </div>

          <Link href="/login" className="block">
            <Button
              variant="outline"
              className="w-full h-11 text-sm font-semibold border-2 border-[#028697] text-[#028697] hover:bg-[#e0f9fc] transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Login
            </Button>
          </Link>

          <Link href="/catalog" className="block">
            <Button
              variant="outline"
              className="w-full h-7 font-normal border-[#a8f0f8] text-[#028697] hover:bg-[#e0f9fc]"
              style={{ textDecoration: 'underline' }}
            >
              <Notebook className="w-2 h-2 mr-0" />
              lihat produk
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
