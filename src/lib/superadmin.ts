import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from './db';

export interface SuperAdminUser {
  id:    string;
  email: string;
  name:  string;
}

/**
 * Verifikasi superadmin langsung ke database.
 * Flag isSuperAdmin di JWT tidak berubah sampai user login ulang, jadi
 * hak yang sudah dicabut tetap "hidup" di token lama. Karena itu setiap
 * page dan server action superadmin memanggil fungsi ini, bukan percaya token.
 */
export async function getSuperAdmin(): Promise<SuperAdminUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await db.user.findUnique({
    where:  { id },
    select: { id: true, email: true, name: true, isSuperAdmin: true, emailVerified: true },
  });
  if (!user || !user.isSuperAdmin || !user.emailVerified) return null;

  return { id: user.id, email: user.email, name: user.name };
}

/** Untuk server component (page/layout): redirect ke login superadmin jika tidak berhak. */
export async function requireSuperAdminPage(): Promise<SuperAdminUser> {
  const admin = await getSuperAdmin();
  if (!admin) redirect('/superadmin/login');
  return admin;
}
