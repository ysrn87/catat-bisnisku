'use server';

import { db } from '@/lib/db';
import { requireStoreAccess } from '@/lib/store-context';

/**
 * Nama toko untuk kepala struk yang dicetak dari modal detail penjualan.
 * Diambil dari server (bukan dari prop) supaya selalu sesuai pengaturan toko terbaru.
 */
export async function getReceiptStoreNameAction(): Promise<string> {
  const { storeId } = await requireStoreAccess();
  const store = await db.store.findUnique({ where: { id: storeId }, select: { name: true } });
  return store?.name ?? '';
}
