import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id           = user.id;
        token.isSuperAdmin = (user as any).isSuperAdmin ?? false; // ← ganti dari role
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id           = token.id as string;
        (session.user as any).isSuperAdmin = token.isSuperAdmin ?? false; // ← ganti dari role
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
