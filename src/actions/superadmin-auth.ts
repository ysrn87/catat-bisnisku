'use server';

import { headers } from 'next/headers';
import { AuthError } from 'next-auth';
import bcrypt from 'bcryptjs';
import { signIn, signOut } from '@/auth';
import { db } from '@/lib/db';
import { checkLoginLimit, getIP } from '@/lib/ratelimit';

// Pesan sama untuk semua kegagalan agar tidak membocorkan siapa yang superadmin.
const GENERIC_ERROR = 'Email atau password salah, atau akun ini tidak memiliki akses superadmin.';

let dummyHash: string | null = null;
function getDummyHash(): string {
  if (!dummyHash) dummyHash = bcrypt.hashSync('dummy-password-for-timing', 10);
  return dummyHash;
}

export async function superAdminLoginAction(formData: FormData) {
  const email    = (formData.get('identifier') as string)?.trim().toLowerCase();
  const password = (formData.get('password') as string) ?? '';

  if (!email || !password) return { success: false, error: GENERIC_ERROR };

  const ip          = getIP(await headers());
  const rateLimited = await checkLoginLimit(ip);
  if (!rateLimited.success) {
    return { success: false, error: rateLimited.error };
  }

  // Tolak sebelum signIn: akun non-superadmin tidak boleh mendapat session dari halaman ini.
  const user = await db.user.findUnique({ where: { email }, select: { isSuperAdmin: true } });
  if (!user?.isSuperAdmin) {
    await bcrypt.compare(password, getDummyHash()); // samakan waktu respons
    return { success: false, error: GENERIC_ERROR };
  }

  try {
    await signIn('credentials', { email, password, redirect: false });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: GENERIC_ERROR };
    }
    throw error;
  }
}

export async function superAdminLogoutAction() {
  await signOut({ redirectTo: '/superadmin/login' });
}
