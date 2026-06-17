'use server';

import { db } from '@/lib/db';
import { requireStoreAccess, PLAN_LIMITS } from '@/lib/store-context';

/**
 * Ambil data penjualan lengkap untuk export Excel.
 * Hanya bisa diakses plan PRO.
 */
export async function getSalesExportData() {
  const { storeId, storePlan } = await requireStoreAccess();

  if (!PLAN_LIMITS[storePlan].exportReports) {
    return { success: false as const, error: 'Fitur export hanya tersedia untuk plan PRO.' };
  }

  const sales = await db.sale.findMany({
    where: { storeId },
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { name: true, phone: true } },
      items: {
        include: {
          variant: { include: { product: { select: { name: true } } } },
        },
      },
    },
  });

  const rows = sales.map((s) => ({
    'No. Transaksi':    s.saleNumber,
    'Tanggal':          s.createdAt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    'Customer':         s.customer?.name ?? 'Umum',
    'Metode Bayar':     s.paymentMethod,
    'Status':           s.paymentStatus,
    'Subtotal':         Number(s.subtotal),
    'Diskon':           Number(s.discount),
    'Pajak':            Number(s.tax),
    'Ongkir':           Number((s as any).ongkir ?? 0),
    'Total':            Number(s.total),
    'Item':             s.items.map((i) => `${i.variant.product.name} - ${i.variant.name} (${i.quantity})`).join('; '),
  }));

  return { success: true as const, data: rows, filename: `laporan-penjualan-${Date.now()}` };
}

/**
 * Ambil data inventori lengkap untuk export Excel.
 */
export async function getInventoryExportData() {
  const { storeId, storePlan } = await requireStoreAccess();

  if (!PLAN_LIMITS[storePlan].exportReports) {
    return { success: false as const, error: 'Fitur export hanya tersedia untuk plan PRO.' };
  }

  const variants = await db.productVariant.findMany({
    where: { storeId },
    include: { product: { select: { name: true, sku: true, type: true } } },
    orderBy: { stock: 'asc' },
  });

  const rows = variants.map((v) => ({
    'Produk':         v.product.name,
    'Varian':         v.name,
    'SKU':            v.sku,
    'Barcode':        v.barcode ?? '',
    'Harga Jual':     Number(v.price),
    'Harga Modal':    Number(v.cost),
    'Stok':           v.stock,
    'Stok Minimum':   v.lowStock,
    'Status':         v.isActive ? 'Aktif' : 'Nonaktif',
    'Nilai Inventori': Number(v.cost) * v.stock,
  }));

  return { success: true as const, data: rows, filename: `laporan-inventori-${Date.now()}` };
}

/**
 * Ambil data cashflow lengkap untuk export Excel.
 */
export async function getCashflowExportData() {
  const { storeId, storePlan } = await requireStoreAccess();

  if (!PLAN_LIMITS[storePlan].exportReports) {
    return { success: false as const, error: 'Fitur export hanya tersedia untuk plan PRO.' };
  }

  const records = await db.cashflow.findMany({
    where: { storeId },
    orderBy: { date: 'desc' },
    include: { createdBy: { select: { name: true } } },
  });

  const rows = records.map((r) => ({
    'Tanggal':    r.date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    'Tipe':       r.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
    'Kategori':   r.category,
    'Keterangan': r.description ?? '',
    'Jumlah':     Number(r.amount),
    'Dicatat oleh': r.createdBy.name,
  }));

  return { success: true as const, data: rows, filename: `laporan-cashflow-${Date.now()}` };
}
