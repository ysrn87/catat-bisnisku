import type { NextAuthConfig } from 'next-auth';

/**
 * Konfigurasi NextAuth yang aman untuk Edge Runtime.
 * TIDAK boleh import: Prisma, bcrypt, atau library Node.js lainnya.
 * Dipakai oleh middleware.ts untuk cek session tanpa bundle berat.
 *
 * Logic authorize yang butuh DB tetap di auth.ts (Node.js runtime).
 */
export const authConfig: NextAuthConfig = {
  providers: [],  // Provider dikonfigurasi di auth.ts — kosong di sini aman
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // Callback ini dijalankan di Edge untuk cek apakah request boleh lanjut
      // Tapi kita handle routing manual di middleware.ts, jadi return true saja
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id   = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
};
