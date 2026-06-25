'use server';

import { db } from '@/lib/db';
import { requireStoreAccess, PLAN_LIMITS } from '@/lib/store-context';

function sanitizeCsvValue(value: string | number | null | undefined): string | number {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  const str = String(value);
  if (/^[=+\-@]/.test(str)) return `'${str}`;
  return str;
}

export async function getSalesExportData() {
  const { storeId, storePlan } = await requireStoreAccess();

  if (!PLAN_LIMITS[storePlan].exportReports) {
    return { success: false as const, error: 'Fitur export hanya tersedia untuk plan PRO.' };
  }

  const sales = await db.sale.findMany({
    where:   { storeId },
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { name: true, phone: true } },
      // FIX: paymentMethod & paymentStatus pindah ke Payment model
      payment:  { select: { method: true, status: true } },
      items: {
        include: {
          variant: { include: { product: { select: { name: true } } } },
        },
      },
    },
  });

  const rows = sales.map((s) => ({
    'No. Transaksi': sanitizeCsvValue(s.saleNumber),
    'Tanggal':       s.createdAt.toLocaleDateString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }),
    'Customer':      sanitizeCsvValue(s.customer?.name ?? 'Umum'),
    // FIX: s.paymentMethod → s.payment?.method
    'Metode Bayar':  sanitizeCsvValue(s.payment?.method ?? '-'),
    // FIX: s.paymentStatus → s.payment?.status
    'Status':        sanitizeCsvValue(s.payment?.status ?? '-'),
    'Subtotal':      Number(s.subtotal),
    'Diskon':        Number(s.discount),
    'Pajak':         Number(s.tax),
    'Ongkir':        Number(s.ongkir ?? 0),
    'Total':         Number(s.total),
    'Item':          sanitizeCsvValue(
      s.items.map((i) => `${i.variant.product.name} - ${i.variant.name} (${i.quantity})`).join('; ')
    ),
  }));

  return { success: true as const, data: rows, filename: `laporan-penjualan-${Date.now()}` };
}

export async function getInventoryExportData() {
  const { storeId, storePlan } = await requireStoreAccess();

  if (!PLAN_LIMITS[storePlan].exportReports) {
    return { success: false as const, error: 'Fitur export hanya tersedia untuk plan PRO.' };
  }

  const variants = await db.productVariant.findMany({
    where:   { storeId },
    include: { product: { select: { name: true } } }, // FIX: hapus sku dari product (tidak ada di Product lagi)
    orderBy: { stock: 'asc' },
  });

  const rows = variants.map((v) => ({
    'Produk':          sanitizeCsvValue(v.product.name),
    'Varian':          sanitizeCsvValue(v.name),
    'SKU':             sanitizeCsvValue(v.sku),
    'Barcode':         sanitizeCsvValue(v.barcode ?? ''),
    'Tipe':            v.type === 'PREORDER' ? 'Pre-Order' : 'Ready Stock',
    'Harga Jual':      Number(v.price),
    'Harga Modal':     Number(v.cost),
    'Stok':            v.type === 'PREORDER' ? '-' : v.stock,
    // FIX: v.lowStock → v.lowStockAt
    'Stok Minimum':    v.type === 'PREORDER' ? '-' : v.lowStockAt,
    'Status':          v.isActive ? 'Aktif' : 'Nonaktif',
    'Nilai Inventori': v.type === 'PREORDER' ? 0 : Number(v.cost) * v.stock,
  }));

  return { success: true as const, data: rows, filename: `laporan-inventori-${Date.now()}` };
}

export async function getCashflowExportData() {
  const { storeId, storePlan } = await requireStoreAccess();

  if (!PLAN_LIMITS[storePlan].exportReports) {
    return { success: false as const, error: 'Fitur export hanya tersedia untuk plan PRO.' };
  }

  // FIX: hapus include createdBy — field dihapus dari schema
  // FIX: orderBy date → occurredAt
  const records = await db.cashflow.findMany({
    where:   { storeId },
    orderBy: { occurredAt: 'desc' },
  });

  const rows = records.map((r) => ({
    // FIX: r.date → r.occurredAt
    'Tanggal':    r.occurredAt.toLocaleDateString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }),
    'Tipe':       r.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
    'Kategori':   sanitizeCsvValue(r.category),
    'Keterangan': sanitizeCsvValue(r.description ?? ''),
    'Jumlah':     Number(r.amount),
    // FIX: hapus 'Dicatat oleh' — createdBy tidak ada di schema baru
  }));

  return { success: true as const, data: rows, filename: `laporan-cashflow-${Date.now()}` };
}
