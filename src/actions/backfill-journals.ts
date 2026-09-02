'use server';

// ─────────────────────────────────────────────────────────────────────────────
// BACKFILL JOURNALS
// Generate jurnal dari data penjualan & cashflow yang sudah ada sebelum
// modul akuntansi dipasang. Dipanggil sekali dari tombol di halaman akuntansi.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '@/lib/db';
import { requireStoreAccess } from '@/lib/store-context';
import { generateSaleJournals, generateCashflowJournal } from '@/modules/accounting/lib/journal-engine';

export async function backfillJournalsAction() {
  try {
    const { storeId, storeRole } = await requireStoreAccess();

    if (!['OWNER', 'ADMINISTRATOR'].includes(storeRole)) {
      return { success: false, error: 'Unauthorized' };
    }

    // Cek CoA sudah di-seed
    const accountCount = await db.account.count({ where: { storeId } });
    if (accountCount === 0) {
      return { success: false, error: 'Inisialisasi Chart of Accounts dulu sebelum backfill' };
    }

    let salesCount    = 0;
    let cashflowCount = 0;
    let errorCount    = 0;

    // ── Backfill dari Penjualan POS ──────────────────────────────────────────
    const sales = await db.sale.findMany({
      where:   { storeId },
      include: {
        items:   { include: { variant: { select: { id: true, cost: true } } } },
        payment: { select: { method: true } },
      },
    });

    for (const sale of sales) {
      try {
        // Skip jika jurnal sudah ada untuk sale ini
        const existing = await db.journalEntry.count({
          where: { sourceType: 'POS_SALE', sourceId: sale.id },
        });
        if (existing > 0) continue;

        const hppTotal = sale.items.reduce(
          (sum, item) => sum + Number(item.variant?.cost ?? 0) * item.quantity,
          0,
        );

        await generateSaleJournals({
          storeId,
          saleId:        sale.id,
          total:         Number(sale.total),
          hpp:           hppTotal,
          paymentMethod: sale.payment?.method ?? 'CASH',
          date:          sale.createdAt,
          saleNumber:    sale.saleNumber,
        });

        salesCount++;
      } catch (err: any) {
        console.warn(`Backfill sale ${sale.id} failed:`, err.message);
        errorCount++;
      }
    }

    // ── Backfill dari Cashflow Manual ────────────────────────────────────────
    const cashflows = await db.cashflow.findMany({
      where: {
        storeId,
        saleId: null, // skip yang dari POS (sudah ter-handle di atas)
      },
    });

    for (const cf of cashflows) {
      try {
        // Skip jika jurnal sudah ada
        const existing = await db.journalEntry.count({
          where: { sourceType: 'CASHFLOW', sourceId: cf.id },
        });
        if (existing > 0) continue;

        await generateCashflowJournal({
          storeId,
          cashflowId:    cf.id,
          type:          cf.type as 'INCOME' | 'EXPENSE',
          category:      cf.category,
          amount:        Number(cf.amount),
          paymentMethod: 'CASH',
          date:          cf.occurredAt,
          description:   cf.description ?? `${cf.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} - ${cf.category}`,
        });

        cashflowCount++;
      } catch (err: any) {
        console.warn(`Backfill cashflow ${cf.id} failed:`, err.message);
        errorCount++;
      }
    }

    return {
      success: true,
      message: `Backfill selesai: ${salesCount} penjualan, ${cashflowCount} cashflow diproses${errorCount > 0 ? `, ${errorCount} dilewati` : ''}`,
      salesCount,
      cashflowCount,
      errorCount,
    };
  } catch (error) {
    console.error('backfillJournalsAction error:', error);
    return { success: false, error: 'Gagal melakukan backfill jurnal' };
  }
}
