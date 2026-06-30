import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { put, del } from '@vercel/blob';
import { checkLogoUploadLimit } from '@/lib/ratelimit';
import { revalidatePath } from 'next/cache';

/**
 * POST /api/store/branding/upload
 *
 * Upload logo toko ke Vercel Blob.
 *
 * Sengaja sebagai Route Handler, bukan Server Action — alasannya dua:
 * 1. `bodySizeLimit: '1mb'` di next.config.ts berlaku untuk Server Actions
 *    secara global. Logo maks 1MB yang dibungkus multipart/form-data bisa
 *    sedikit melebihi batas itu persis di file-file mendekati 1MB, jadi
 *    upload file butuh jalur yang tidak terikat limit tersebut.
 * 2. requireStoreAccess() bergantung pada header x-store-slug yang hanya
 *    disuntik middleware untuk path berpola /[slug]/(admin|manager|...).
 *    Route ini ada di /api/store/branding/upload — pola yang berbeda dan
 *    middleware juga sengaja men-skip '/api/store' dari auth check sama
 *    sekali. Karena itu otorisasi di sini dilakukan manual (sama seperti
 *    pola yang sudah dipakai di /api/store/[storeId]/team/route.ts),
 *    bukan via requireStoreAccess().
 */

const MAX_LOGO_SIZE_BYTES     = 1 * 1024 * 1024; // 1MB
const ALLOWED_LOGO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const rateLimited = await checkLogoUploadLimit(session.user.id);
    if (!rateLimited.success) {
      return NextResponse.json({ error: rateLimited.error }, { status: 429 });
    }

    const formData = await req.formData();
    const storeId  = formData.get('storeId');
    const file     = formData.get('logo');

    if (!storeId || typeof storeId !== 'string') {
      return NextResponse.json({ error: 'storeId wajib diisi' }, { status: 400 });
    }
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'File logo wajib diisi' }, { status: 400 });
    }

    // Verifikasi role — hanya OWNER/ADMINISTRATOR yang boleh ubah branding,
    // dan store harus PRO. Pola sama dengan team/route.ts.
    const [staff, store] = await Promise.all([
      db.storeStaff.findUnique({
        where:  { storeId_userId: { storeId, userId: session.user.id } },
        select: { role: true },
      }),
      db.store.findUnique({
        where:  { id: storeId },
        select: { plan: true, slug: true, logoUrl: true },
      }),
    ]);

    if (!staff || (staff.role !== 'OWNER' && staff.role !== 'ADMINISTRATOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!store) {
      return NextResponse.json({ error: 'Toko tidak ditemukan' }, { status: 404 });
    }
    if (store.plan !== 'PRO') {
      return NextResponse.json({ error: 'Fitur custom branding hanya tersedia untuk plan PRO.' }, { status: 403 });
    }

    // Validasi file — tetap dicek di server meski client (branding-tab.tsx)
    // sudah validasi juga, karena endpoint ini bisa dipanggil langsung.
    if (!ALLOWED_LOGO_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Format logo tidak valid. Gunakan JPG, PNG, atau WebP.' }, { status: 400 });
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      return NextResponse.json({ error: 'Ukuran logo maksimal 1MB.' }, { status: 400 });
    }

    const blob = await put(`store-logos/${storeId}-${Date.now()}`, file, {
      access:          'public',
      addRandomSuffix: true,
      contentType:     file.type,
    });

    await db.store.update({
      where: { id: storeId },
      data:  { logoUrl: blob.url },
    });

    // Hapus logo lama (best-effort) setelah logo baru berhasil tersimpan —
    // supaya kalau upload gagal, logo lama tetap utuh dan toko tidak pernah
    // berada di kondisi tanpa logo sama sekali di antara dua operasi.
    if (store.logoUrl && store.logoUrl.includes('.public.blob.vercel-storage.com')) {
      try {
        await del(store.logoUrl);
      } catch (delErr) {
        console.error('[branding/upload] Gagal hapus logo lama:', delErr);
      }
    }

    // Sama seperti revalidatePath di Server Action lain — sidebar (Navigation
    // component) yang merender logo ini dipakai di kelima layout berikut.
    revalidatePath(`/${store.slug}/admin`);
    revalidatePath(`/${store.slug}/admin/settings/profile`);
    revalidatePath(`/${store.slug}/manager`);
    revalidatePath(`/${store.slug}/cashier`);
    revalidatePath(`/${store.slug}/member`);

    return NextResponse.json({ success: true, logoUrl: blob.url });

  } catch (err) {
    console.error('[branding/upload]', err);
    return NextResponse.json({ error: 'Gagal menyimpan logo.' }, { status: 500 });
  }
}
