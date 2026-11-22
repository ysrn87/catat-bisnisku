import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { put, del } from '@vercel/blob';
import { checkLogoUploadLimit } from '@/lib/ratelimit';
import { revalidatePath } from 'next/cache';
import {
  QRIS_ALLOWED_MIME,
  QRIS_BLOB_PREFIX,
  QRIS_MAX_SIZE_BYTES,
  isSafeBlobUrl,
} from '@/lib/payment-accounts';

/**
 * POST /api/store/payment-accounts/qris
 *
 * Upload gambar QRIS untuk satu akun pembayaran bertipe QRIS (Vercel Blob).
 * Body: multipart/form-data { accountId, file }.
 *
 * Route Handler, bukan Server Action, dengan alasan yang sama seperti
 * /api/store/branding/upload: bodySizeLimit Server Action = 1mb, dan middleware
 * tidak menyuntik x-store-slug untuk path /api/store — jadi otorisasi dilakukan
 * manual. storeId TIDAK diterima dari client: diambil dari akun itu sendiri,
 * lalu dicocokkan dengan peran user di toko tersebut.
 */

/** Deteksi tipe gambar dari byte awal file (jangan percaya file.type dari client). */
function sniffImageType(buf: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png';
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50   // WEBP
  ) return 'image/webp';
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const limited = await checkLogoUploadLimit(session.user.id);
    if (!limited.success) {
      return NextResponse.json({ error: limited.error }, { status: 429 });
    }

    const formData  = await req.formData();
    const accountId = formData.get('accountId');
    const file      = formData.get('file');

    if (!accountId || typeof accountId !== 'string') {
      return NextResponse.json({ error: 'accountId wajib diisi' }, { status: 400 });
    }
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'File gambar QRIS wajib diisi' }, { status: 400 });
    }

    const account = await db.storePaymentAccount.findUnique({
      where:  { id: accountId },
      select: { id: true, storeId: true, type: true, qrisImageUrl: true, store: { select: { slug: true } } },
    });
    // Pesan sama untuk "tidak ada" dan "bukan milik toko Anda" agar id tidak bisa ditebak.
    if (!account) {
      return NextResponse.json({ error: 'Akun pembayaran tidak ditemukan' }, { status: 404 });
    }

    const staff = await db.storeStaff.findUnique({
      where:  { storeId_userId: { storeId: account.storeId, userId: session.user.id } },
      select: { role: true },
    });
    if (!staff || (staff.role !== 'OWNER' && staff.role !== 'ADMINISTRATOR')) {
      return NextResponse.json({ error: 'Akun pembayaran tidak ditemukan' }, { status: 404 });
    }

    if (account.type !== 'QRIS') {
      return NextResponse.json({ error: 'Gambar hanya untuk akun bertipe QRIS.' }, { status: 400 });
    }
    if (!QRIS_ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: 'Format gambar tidak valid. Gunakan JPG, PNG, atau WebP.' }, { status: 400 });
    }
    if (file.size > QRIS_MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Ukuran gambar QRIS maksimal 2MB.' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const realType = sniffImageType(bytes);
    if (!realType) {
      return NextResponse.json({ error: 'Isi file bukan gambar JPG, PNG, atau WebP yang valid.' }, { status: 400 });
    }

    const blob = await put(`${QRIS_BLOB_PREFIX}/${account.storeId}-${Date.now()}`, file, {
      access:          'public',
      addRandomSuffix: true,
      contentType:     realType,
    });

    await db.storePaymentAccount.update({
      where: { id: account.id },
      data:  { qrisImageUrl: blob.url },
    });

    // Hapus gambar lama setelah yang baru tersimpan (best-effort), sama seperti logo.
    if (isSafeBlobUrl(account.qrisImageUrl)) {
      try {
        await del(account.qrisImageUrl);
      } catch (delErr) {
        console.error('[payment-accounts/qris] gagal hapus gambar lama:', delErr);
      }
    }

    revalidatePath(`/${account.store.slug}/admin/settings/payment`);

    return NextResponse.json({ success: true, qrisImageUrl: blob.url });
  } catch (err) {
    console.error('[payment-accounts/qris]', err);
    return NextResponse.json({ error: 'Gagal menyimpan gambar QRIS.' }, { status: 500 });
  }
}
