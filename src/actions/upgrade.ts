'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

/**
 * Buat Midtrans Snap token untuk upgrade PRO.
 * Dipanggil dari UpgradeButton saat user klik "Upgrade Sekarang".
 *
 * Flow:
 *   Client klik tombol → createSnapToken() → dapat token
 *   → window.snap.pay(token) → user bayar
 *   → Midtrans kirim webhook ke /api/midtrans/webhook
 *   → store diupgrade ke PRO otomatis
 */
export async function createSnapToken(storeSlug: string): Promise<
  | { success: true; token: string; orderId: string }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      redirect(`/login?callbackUrl=/${storeSlug}/upgrade`);
    }

    const store = await db.store.findUnique({
      where:  { slug: storeSlug },
      // FIX: tidak ada subscriptionExpiresAt — select field yang ada
      select: { id: true, name: true, plan: true, ownerId: true, planExpiresAt: true },
    });

    if (!store) return { success: false, error: 'Toko tidak ditemukan' };
    if (store.plan === 'PRO') {
      // Cek apakah PRO masih aktif
      if (store.planExpiresAt && store.planExpiresAt > new Date()) {
        return { success: false, error: 'Toko sudah PRO dan masih aktif' };
      }
    }
    if (store.ownerId !== session.user.id) return { success: false, error: 'Unauthorized' };

    const user = await db.user.findUnique({
      where:  { id: session.user.id },
      select: { name: true, email: true, phone: true },
    });

    if (!user) return { success: false, error: 'User tidak ditemukan' };

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      return { success: false, error: 'Mohon maaf, konfigurasi payment belum diatur. Hubungi kami untuk upgrade.' };
    }

    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
    const baseUrl = isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    // Format: PRO-{slug}-{timestamp}
    const orderId = `PRO-${storeSlug}-${Date.now()}`;

    const payload = {
      transaction_details: {
        order_id:     orderId,
        gross_amount: 99000,
      },
      item_details: [
        {
          id:       'PRO-MONTHLY',
          price:    99000,
          quantity: 1,
          name:     `Catat Bisnisku PRO - ${store.name}`,
        },
      ],
      customer_details: {
        first_name: user.name,
        email:      user.email   || undefined,
        phone:      user.phone   || undefined,
      },
      callbacks: {
        finish: `${process.env.NEXTAUTH_URL}/${storeSlug}/upgrade/success`,
      },
    };

    const response = await fetch(baseUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[createSnapToken] Midtrans error:', err);
      return { success: false, error: 'Gagal membuat transaksi. Coba lagi.' };
    }

    const data = await response.json() as { token: string; redirect_url: string };
    return { success: true, token: data.token, orderId };

  } catch (error) {
    console.error('[createSnapToken] Error:', error);
    return { success: false, error: 'Terjadi kesalahan. Coba lagi.' };
  }
}
