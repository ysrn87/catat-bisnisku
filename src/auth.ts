import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from './lib/db';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        identifier: { label: 'Email or Phone', type: 'text' },
        password:   { label: 'Password',       type: 'password' },
        // slug dioper dari login form agar bisa resolve storeRole
        storeSlug:  { label: 'Store Slug',     type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null;

        const user = await db.user.findFirst({
          where: {
            OR: [
              { email: credentials.identifier as string },
              { phone: credentials.identifier as string },
            ],
          },
        });

        if (!user) return null;

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) return null;

        // Resolve storeSlug → storeId → storeRole (opsional saat login)
        let storeSlug: string | null = null;
        let storeRole: string | null = null;

        if (credentials.storeSlug) {
          const slug = credentials.storeSlug as string;
          const storeUser = await db.storeUser.findFirst({
            where: {
              userId: user.id,
              store: { slug },
            },
            include: { store: { select: { slug: true } } },
          });

          if (storeUser) {
            storeSlug = storeUser.store.slug;
            storeRole = storeUser.role;
          }
        }

        return {
          id:        user.id,
          email:     user.email || user.phone,
          name:      user.name,
          role:      user.role,
          storeSlug: storeSlug ?? undefined,
          storeRole: storeRole ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id        = user.id;
        token.role      = user.role as Role;
        token.storeSlug = (user as any).storeSlug ?? null;
        token.storeRole = (user as any).storeRole ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id        = token.id as string;
        session.user.role      = token.role as Role;
        session.user.storeSlug = token.storeSlug as string | null;
        session.user.storeRole = token.storeRole as string | null;
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
});
