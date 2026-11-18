'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { list, del } from '@vercel/blob';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { checkDeleteStoreLimit } from '@/lib/ratelimit';
import { createDeleteStoreChallenge, verifyDeleteStoreChallenge } from '@/lib/delete-store-challenge';
import { purgeStoreData } from '@/lib/store-purge';
import { sendEmail } from '@/lib/email';

type ChallengeResult =
  | { success: true; phrase: string; token: string }
  | { success: false; error: string };

type DeleteResult =
  | { success: true }
  | { success: false; error: string; code?: 'EXPIRED' };

/** Hanya OWNER toko (Store.ownerId, dicek ke DB) yang boleh menghapus. */
async function loadOwnedStore(storeId: string) {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId || !storeId) return null;

  const store = await db.store.findUnique({
    where:  { id: storeId },
    select: { id: true, name: true, slug: true, ownerId: true, logoUrl: true },
  });
  if (!store || store.ownerId !== userId) return null;

  return { userId, store };
}

const NOT_OWNER = 'Hanya pemilik toko yang dapat menghapus toko ini.';

export async function createDeleteStoreChallengeAction(storeId: string): Promise<ChallengeResult> {
  const ctx = await loadOwnedStore(storeId);
  if (!ctx) return { success: false, error: NOT_OWNER };

  const { phrase, token } = createDeleteStoreChallenge(ctx.userId, ctx.store.id);
  return { success: true, phrase, token };
}

/** Hapus file Vercel Blob milik toko (logo). Best-effort: gagal tidak membatalkan penghapusan. */
async function deleteStoreBlobs(storeId: string, logoUrl: string | null) {
  try {
    const urls = new Set<string>();
    if (logoUrl && logoUrl.includes('.public.blob.vercel-storage.com')) urls.add(logoUrl);

    let cursor: string | undefined;
    do {
      const res = await list({ prefix: `store-logos/${storeId}-`, cursor });
      res.blobs.forEach((b) => urls.add(b.url));
      cursor = res.hasMore ? res.cursor : undefined;
    } while (cursor);

    if (urls.size > 0) await del([...urls]);
  } catch (error) {
    console.error('[delete-store] gagal menghapus file blob:', error);
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function deleteStoreAction(formData: FormData): Promise<DeleteResult> {
  const storeId      = String(formData.get('storeId') ?? '');
  const token        = String(formData.get('token') ?? '');
  const phrase       = String(formData.get('phrase') ?? '');
  const password     = String(formData.get('password') ?? '');
  const acknowledged = formData.get('acknowledge') === 'yes';

  const ctx = await loadOwnedStore(storeId);
  if (!ctx) return { success: false, error: NOT_OWNER };

  if (!acknowledged) return { success: false, error: 'Centang pernyataan bahwa penghapusan tidak dapat dibatalkan.' };
  if (!password)     return { success: false, error: 'Password wajib diisi.' };

  // Batasi percobaan: endpoint ini menerima password, jangan jadi jalur brute-force.
  const limited = await checkDeleteStoreLimit(ctx.userId);
  if (!limited.success) return { success: false, error: limited.error };

  // 1. Kalimat verifikasi
  const verification = verifyDeleteStoreChallenge(token, ctx.userId, ctx.store.id, phrase);
  if (!verification.ok) {
    if (verification.reason === 'EXPIRED') {
      return { success: false, code: 'EXPIRED', error: 'Kalimat verifikasi kedaluwarsa. Kalimat baru sudah dibuat, silakan ketik ulang.' };
    }
    return { success: false, error: verification.reason === 'MISMATCH' ? 'Kalimat verifikasi tidak sama.' : 'Verifikasi tidak valid. Muat ulang halaman lalu coba lagi.' };
  }

  // 2. Password akun
  const user = await db.user.findUnique({
    where:  { id: ctx.userId },
    select: { password: true, email: true, name: true },
  });
  if (!user?.password) return { success: false, error: 'Akun ini tidak memiliki password. Hubungi admin.' };
  if (!(await bcrypt.compare(password, user.password))) {
    return { success: false, error: 'Password salah.' };
  }

  // 3. Hapus semua data dalam SATU transaksi: semua terhapus, atau tidak sama sekali.
  try {
    await db.$transaction(
      async (tx) => { await purgeStoreData(tx, { id: ctx.store.id, slug: ctx.store.slug }); },
      { timeout: 120_000, maxWait: 10_000 }
    );
  } catch (error) {
    console.error('[delete-store] transaksi gagal, tidak ada data yang dihapus:', error);
    return { success: false, error: 'Gagal menghapus toko. Tidak ada data yang dihapus. Coba lagi atau hubungi admin.' };
  }

  // 4. Setelah DB bersih: hapus file di storage + beri tahu owner (best-effort)
  await deleteStoreBlobs(ctx.store.id, ctx.store.logoUrl);

  try {
    const when = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    await sendEmail({
      to:      user.email,
      subject: `Toko "${ctx.store.name}" telah dihapus`,
      html: `<p>Halo ${esc(user.name)},</p>
<p>Toko <strong>${esc(ctx.store.name)}</strong> beserta seluruh datanya telah dihapus permanen pada ${esc(when)} WIB. Tindakan ini tidak dapat dibatalkan.</p>
<p>Jika bukan Anda yang melakukannya, segera ganti password akun Anda dan hubungi kami.</p>`,
    });
  } catch (error) {
    console.error('[delete-store] gagal mengirim email notifikasi:', error);
  }

  revalidatePath('/store-select');
  return { success: true };
}
