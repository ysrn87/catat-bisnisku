import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname   = nextUrl.pathname;

      // Route publik — selalu izinkan
      const publicPaths = [
        '/login',
        '/register',
        '/register-store',
        '/unauthorized',
        '/offline',
        '/invitation',
      ];
      const isPublic = publicPaths.some(
        (p) => pathname === p || pathname.startsWith(p + '/')
      );
      if (isPublic) return true;

      // API routes — biarkan handler masing-masing yang protect
      if (pathname.startsWith('/api/')) return true;

      // Root landing page
      if (pathname === '/') return true;

      // Semua route lain butuh login
      if (!isLoggedIn) return false;

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id           = user.id;
        token.isSuperAdmin = (user as any).isSuperAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id           = token.id as string;
        (session.user as any).isSuperAdmin = token.isSuperAdmin ?? false;
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
