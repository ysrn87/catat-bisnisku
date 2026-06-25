import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

/**
 * POST /api/midtrans/webhook
 *
 * Dipanggil otomatis oleh Midtrans setiap kali status transaksi berubah.
 * Konfigurasi URL di Midtrans Dashboard → Settings → Payment Notification URL.
 *
 * Flow upgrade PRO:
 *   User bayar → Midtrans settlement → webhook ini → verifikasi → plan=PRO
 *
 * order_id format: "PRO-{storeSlug}-{timestamp}"
 * Contoh: "PRO-toko-budi-1718500000000"
 */

function verifySignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return false;
  const input    = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const expected = createHash('sha512').update(input).digest('hex');
  return expected === signatureKey;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      order_id,
      transaction_status,
      fraud_status,
      status_code,
      gross_amount,
      signature_key,
    } = body;

    // 1. Verifikasi signature
    if (!verifySignature(order_id, status_code, gross_amount, signature_key)) {
      console.error('[midtrans/webhook] Signature tidak valid:', order_id);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // 2. Hanya proses order PRO
    if (!order_id?.startsWith('PRO-')) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Extract slug: "PRO-toko-budi-1718500000000" → "toko-budi"
    const parts     = order_id.split('-');
    const storeSlug = parts.slice(1, -1).join('-');

    if (!storeSlug) {
      console.error('[midtrans/webhook] Gagal parse storeSlug dari order_id:', order_id);
      return NextResponse.json({ error: 'Invalid order_id format' }, { status: 400 });
    }

    // 3. Cek status transaksi
    const isSuccess = (transaction_status === 'settlement') ||
                      (transaction_status === 'capture' && fraud_status === 'accept');
    const isPending = transaction_status === 'pending';
    const isFailed  = ['deny', 'cancel', 'expire'].includes(transaction_status);

    // 4. Idempotency check — FIX: where: { midtransOrderId } bukan { orderId }
    const existingPayment = await db.payment.findUnique({
      where: { midtransOrderId: order_id },
    });
    if (existingPayment) {
      console.log(`[midtrans/webhook] Duplicate notification untuk order_id: ${order_id}, skip.`);
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (isSuccess) {
      const store = await db.store.findUnique({
        where:  { slug: storeSlug },
        // FIX: subscriptionExpiresAt → planExpiresAt
        select: { id: true, name: true, planExpiresAt: true },
      });

      if (!store) {
        console.error('[midtrans/webhook] Store tidak ditemukan:', storeSlug);
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }

      // Hitung expiry: +30 hari, perpanjang dari sisa kalau masih aktif
      // FIX: subscriptionExpiresAt → planExpiresAt
      const baseDate =
        store.planExpiresAt && store.planExpiresAt > new Date()
          ? store.planExpiresAt
          : new Date();

      const expiresAt = new Date(baseDate);
      expiresAt.setDate(expiresAt.getDate() + 30);

      await db.$transaction(async (tx) => {
        // FIX: subscriptionExpiresAt → planExpiresAt
        await tx.store.update({
          where: { slug: storeSlug },
          data:  { plan: 'PRO', planExpiresAt: expiresAt, updatedAt: new Date() },
        });

        // FIX: Payment schema baru — saleId UNIQUE, midtransOrderId, method, status, amount, paidAt
        // Untuk transaksi upgrade PRO, tidak ada saleId (bukan transaksi POS)
        // Kita buat Payment tanpa saleId dengan storeId langsung
        await tx.payment.create({
          data: {
            // saleId wajib di schema baru karena 1-to-1 dengan Sale
            // Tapi upgrade PRO bukan Sale — simpan sebagai catatan terpisah via tabel lain,
            // atau buat Sale dummy. Solusi terbaik: buat model UpgradePayment terpisah.
            // Untuk sementara, catat di tabel payment dengan workaround:
            // saleId di-generate sebagai string khusus untuk upgrade
            saleId:         `upgrade-${store.id}-${Date.now()}`, // temporary workaround
            storeId:        store.id,
            method:         'MIDTRANS',
            status:         'PAID',
            amount:         parseFloat(gross_amount),
            midtransOrderId: order_id,
            paidAt:         new Date(),
          },
        });
      });

      console.log(`[midtrans/webhook] ✓ Store "${storeSlug}" upgraded ke PRO sampai ${expiresAt.toISOString()}`);

    } else if (isFailed) {
      const store = await db.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
      if (store) {
        await db.payment.create({
          data: {
            saleId:         `upgrade-${store.id}-${Date.now()}`,
            storeId:        store.id,
            method:         'MIDTRANS',
            status:         'FAILED',
            amount:         parseFloat(gross_amount),
            midtransOrderId: order_id,
          },
        }).catch(() => {});
      }
      console.log(`[midtrans/webhook] Transaksi gagal untuk store "${storeSlug}":`, transaction_status);

    } else if (isPending) {
      console.log(`[midtrans/webhook] Transaksi pending untuk store "${storeSlug}"`);
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('[midtrans/webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
