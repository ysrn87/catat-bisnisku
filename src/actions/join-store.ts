'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function searchStoreAction(query: string) {
  const q = query.trim();
  if (!q) return { success: true, data: [] };

  const stores = await db.store.findMany({
    where: {
      OR: [
        { slug: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, slug: true, logoUrl: true },
    take: 10,
    orderBy: { name: 'asc' },
  });

  return { success: true, data: stores };
}

/**
 * User yang sudah login join sebagai MEMBER di toko yang dipilih.
 * UPDATED: StoreUser sekarang tidak punya kolom role — murni untuk member.
 * Cek juga apakah user sudah jadi staff di toko ini (StoreStaff) —
 * kalau iya, tetap boleh join sebagai member (dua tabel terpisah).
 */
export async function joinStoreAction(storeSlugOrId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Silakan login terlebih dahulu' };
    }

    const store = await db.store.findFirst({
      where: { OR: [{ slug: storeSlugOrId }, { id: storeSlugOrId }] },
      select: { id: true, slug: true, name: true },
    });
    if (!store) {
      return { success: false, error: 'Toko tidak ditemukan' };
    }

    // Cek apakah sudah jadi member di toko ini
    const existingMember = await db.storeUser.findUnique({
      where: { storeId_userId: { storeId: store.id, userId: session.user.id } },
    });
    if (existingMember) {
      return { success: true, data: { slug: store.slug }, alreadyMember: true };
    }

    // UPDATED: StoreUser tanpa kolom role
    await db.$transaction(async (tx) => {
      const storeUser = await tx.storeUser.create({
        data: { storeId: store.id, userId: session.user.id, points: 0 },
      });

      await tx.pointHistory.create({
        data: {
          storeUserId: storeUser.id,
          type:        'REGISTER',
          delta:       0,
          description: `Bergabung sebagai member di ${store.name}`,
        },
      });
    });

    revalidatePath('/store-select');
    revalidatePath('/member-select');

    return { success: true, data: { slug: store.slug } };
  } catch (error) {
    console.error('Join store error:', error);
    return { success: false, error: 'Gagal join toko. Silakan coba lagi.' };
  }
}
