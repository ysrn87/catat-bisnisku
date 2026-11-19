import { db } from './db';

/**
 * Total inventori SELURUH varian toko (bukan hanya baris di halaman yang tampil).
 *
 * - Nilai (modal) = Σ cost × stock, estimasi harga jual = Σ price × stock.
 * - Varian PREORDER tidak dihitung: tidak ada stok fisik. Aturan yang sama dipakai
 *   di Laporan Inventori dan Laporan Keuangan supaya angkanya selalu sama.
 * - Dihitung di database (SUM) agar tidak memuat semua varian ke memori.
 * - lowStockCount: varian dengan stock <= lowStockAt (batas per varian).
 */
export async function getInventoryTotals(storeId: string): Promise<{
  inventoryValue: number;
  inventoryPrice: number;
  lowStockCount:  number;
}> {
  const [rows, lowStockCount] = await Promise.all([
    db.$queryRaw<Array<{ inventoryValue: unknown; inventoryPrice: unknown }>>`
      SELECT COALESCE(SUM("cost"  * "stock"), 0) AS "inventoryValue",
             COALESCE(SUM("price" * "stock"), 0) AS "inventoryPrice"
      FROM "product_variants"
      WHERE "storeId" = ${storeId} AND "type" <> 'PREORDER'
    `,
    db.productVariant.count({
      where: { storeId, stock: { lte: db.productVariant.fields.lowStockAt } },
    }),
  ]);

  return {
    inventoryValue: Number(rows[0]?.inventoryValue ?? 0),
    inventoryPrice: Number(rows[0]?.inventoryPrice ?? 0),
    lowStockCount,
  };
}
