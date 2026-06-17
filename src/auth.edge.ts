import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

/**
 * Instance NextAuth khusus Edge Runtime — TANPA Credentials provider,
 * TANPA Prisma, TANPA bcrypt. Hanya dipakai untuk membaca/verifikasi
 * JWT session di middleware.ts agar bundle Edge Function tetap kecil.
 *
 * Untuk login (authorize) dan operasi yang butuh DB, pakai `auth` dari './auth' (Node.js runtime).
 */
export const { auth } = NextAuth(authConfig);
