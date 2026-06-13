import { Role } from '@prisma/client';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id:         string;
      role:       Role;
      storeSlug:  string | null;
      storeRole:  string | null;
    } & DefaultSession['user'];
  }

  interface User {
    role:       Role;
    storeSlug?: string;
    storeRole?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id:         string;
    role:       Role;
    storeSlug:  string | null;
    storeRole:  string | null;
  }
}
