'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { superAdminLoginAction } from '@/actions/superadmin-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await superAdminLoginAction(new FormData(e.currentTarget));
    if (result.success) {
      router.push('/superadmin');
      router.refresh();
    } else {
      setError(result.error || 'Login gagal.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-700 shadow-2xl">
        <CardHeader className="space-y-3 pb-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900">
            <ShieldCheck className="h-7 w-7 text-[#a8f0f8]" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900">Superadmin</CardTitle>
          <CardDescription>Area khusus pengelola Catat Bisnisku</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="flex items-center gap-2 text-xs font-light">
                <Mail className="h-4 w-4 text-gray-500" /> Email
              </Label>
              <Input id="identifier" name="identifier" type="email" required autoComplete="username" disabled={loading} className="h-11" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2 text-xs font-light">
                <Lock className="h-4 w-4 text-gray-500" /> Password
              </Label>
              <div className="relative">
                <Input
                  id="password" name="password" required autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'} disabled={loading} className="h-11 pr-10"
                />
                <button
                  type="button" onClick={() => setShowPassword(!showPassword)} disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <Button type="submit" disabled={loading} className="h-11 w-full bg-slate-900 text-white hover:bg-slate-700">
              {loading ? 'Memeriksa...' : 'Masuk'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
