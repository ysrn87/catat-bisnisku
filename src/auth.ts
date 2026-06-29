import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from './lib/db';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';

if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
  throw new Error(
    '[auth] NEXTAUTH_SECRET tidak diset atau terlalu pendek (min 32 karakter). ' +
    'Generate dengan: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user)              return null;
        if (!user.password)     return null;
        if (!user.emailVerified) return null; // wajib verifikasi email dulu

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!isValid) return null;

        return {
          id:           user.id,
          email:        user.email,
          name:         user.name,
          isSuperAdmin: user.isSuperAdmin,
        };
      },
    }),
  ],
});
