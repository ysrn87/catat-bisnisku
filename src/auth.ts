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
        identifier: { label: 'Email or Phone', type: 'text' },
        password:   { label: 'Password',       type: 'password' },
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

        // Walk-in customer accounts have no password — cannot log in directly
        if (!user.password) return null;

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) return null;

        // UPDATED: tidak ada storeRole di session level —
        // role per toko diambil dari StoreStaff saat requireStoreAccess() dipanggil
        return {
          id:           user.id,
          email:        user.email || user.phone,
          name:         user.name,
          isSuperAdmin: user.isSuperAdmin,
        };
      },
    }),
  ],
});
