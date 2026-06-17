import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

/**
 * POST /api/midtrans/webhook
 *
 * Dipanggil otomatis oleh Midtrans setiap kali status transaksi berubah.
 * Konfigurasi URL ini di Midtrans Dashboard → Settings → Configuration → Payment Notification URL.
 *
 * Flow:
 *   User bayar PRO → Midtrans settlement → webhook ini dipanggil
 *   → verifikasi signature → set plan=PRO + subscriptionExpiresAt=+30hari
 *
 * Cara buat order_id saat checkout PRO:
 *   order_id: `PRO-${storeSlug}-${Date.now()}`
 *   Contoh: "PRO-toko-budi-1718500000000"
 *
 * Referensi: https://docs.midtrans.com/reference/handling-notifications
 */

// Verifikasi signature Midtrans
// Format: SHA512(order_id + status_code + gross_amount + server_key)
function verifySignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return false;

  const input = `${orderId}${statusCode}${grossAmount}${serverKey}`;
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

    // ── 1. Verifikasi signature ──────────────────────────────────────────────
    if (!verifySignature(order_id, status_code, gross_amount, signature_key)) {
      console.error('[midtrans/webhook] Signature tidak valid:', order_id);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // ── 2. Hanya proses order PRO ────────────────────────────────────────────
    // order_id format: "PRO-{storeSlug}-{timestamp}"
    if (!order_id?.startsWith('PRO-')) {
      // Bukan transaksi upgrade PRO, abaikan
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Extract slug: "PRO-toko-budi-1718500000000" → "toko-budi"
    const parts = order_id.split('-');
    // Hapus prefix "PRO" dan suffix timestamp (bagian terakhir)
    const storeSlug = parts.slice(1, -1).join('-');

    if (!storeSlug) {
      console.error('[midtrans/webhook] Gagal parse storeSlug dari order_id:', order_id);
      return NextResponse.json({ error: 'Invalid order_id format' }, { status: 400 });
    }

    // ── 3. Cek status transaksi ──────────────────────────────────────────────
    const isSuccess =
      (transaction_status === 'settlement') ||
      (transaction_status === 'capture' && fraud_status === 'accept');

    const isPending =
      transaction_status === 'pending';

    const isFailed =
      transaction_status === 'deny' ||
      transaction_status === 'cancel' ||
      transaction_status === 'expire';

    // ── 4. Idempotency check — skip kalau order_id sudah pernah diproses ────
    const existingPayment = await db.payment.findUnique({ where: { orderId: order_id } });
    if (existingPayment) {
      console.log(`[midtrans/webhook] Duplicate notification untuk order_id: ${order_id}, skip.`);
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // ── 5. Proses sesuai status ──────────────────────────────────────────────
    if (isSuccess) {
      const store = await db.store.findUnique({
        where: { slug: storeSlug },
        select: { id: true, name: true, subscriptionExpiresAt: true },
      });

      if (!store) {
        console.error('[midtrans/webhook] Store tidak ditemukan:', storeSlug);
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }

      // Hitung expiry: +30 hari dari sekarang
      // Kalau masih ada sisa PRO yang belum habis, perpanjang dari sisa itu
      const baseDate =
        store.subscriptionExpiresAt && store.subscriptionExpiresAt > new Date()
          ? store.subscriptionExpiresAt
          : new Date();

      const expiresAt = new Date(baseDate);
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Lakukan upgrade + catat payment dalam satu transaksi — atomik
      await db.$transaction(async (tx) => {
        await tx.store.update({
          where: { slug: storeSlug },
          data: { plan: 'PRO', subscriptionExpiresAt: expiresAt, updatedAt: new Date() },
        });

        await tx.payment.create({
          data: {
            orderId:     order_id,
            storeId:     store.id,
            status:      transaction_status,
            grossAmount: parseFloat(gross_amount),
          },
        });
      });

      console.log(`[midtrans/webhook] ✓ Store "${storeSlug}" upgraded ke PRO sampai ${expiresAt.toISOString()}`);

    } else if (isFailed) {
      // Catat payment gagal untuk audit trail
      const store = await db.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
      if (store) {
        await db.payment.create({
          data: {
            orderId:     order_id,
            storeId:     store.id,
            status:      transaction_status,
            grossAmount: parseFloat(gross_amount),
          },
        }).catch(() => {}); // Jangan block response kalau gagal catat
      }
      console.log(`[midtrans/webhook] Transaksi gagal untuk store "${storeSlug}":`, transaction_status);

    } else if (isPending) {
      // Masih menunggu pembayaran — tidak aksi dulu
      console.log(`[midtrans/webhook] Transaksi pending untuk store "${storeSlug}"`);
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('[midtrans/webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
