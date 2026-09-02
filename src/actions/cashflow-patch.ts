// ─────────────────────────────────────────────────────────────────────────────
// PATCH UNTUK src/actions/cashflow.ts
//
// Tambahkan import ini di bagian atas file cashflow.ts:
// import { generateCashflowJournal, deleteJournalsBySource } from
//   '@/modules/accounting/lib/journal-engine';
//
// Lalu tambahkan hook berikut di setiap action yang relevan:
// ─────────────────────────────────────────────────────────────────────────────

// ── Di createCashflowAction, setelah db.cashflow.create() berhasil ──────────
//
// const created = await db.cashflow.create({ data: { ... } });
//
// // Generate jurnal otomatis
// await generateCashflowJournal({
//   storeId,
//   cashflowId:    created.id,
//   type:          type,
//   category:      category,
//   amount:        amount,
//   paymentMethod: 'CASH', // cashflow belum punya field metode bayar — default CASH
//   date:          occurredAt,
//   description:   description,
// });


// ── Di updateCashflowAction, setelah db.cashflow.update() berhasil ──────────
//
// await db.cashflow.update({ where: { id }, data: { ... } });
//
// // Re-generate jurnal (generateCashflowJournal menghapus yang lama dulu)
// await generateCashflowJournal({
//   storeId,
//   cashflowId:    id,
//   type:          type,
//   category:      category,
//   amount:        amount,
//   paymentMethod: 'CASH',
//   date:          occurredAt,
//   description:   description,
// });


// ── Di deleteCashflowAction, setelah db.cashflow.delete() berhasil ──────────
//
// await db.cashflow.delete({ where: { id } });
//
// // Hapus jurnal terkait
// await deleteJournalsBySource('CASHFLOW', id);


// ─────────────────────────────────────────────────────────────────────────────
// PATCH UNTUK src/actions/sales.ts
//
// Tambahkan import:
// import { generateSaleJournals, deleteJournalsBySource } from
//   '@/modules/accounting/lib/journal-engine';
//
// Di createSaleAction, setelah sale berhasil dibuat, tambahkan:
// ─────────────────────────────────────────────────────────────────────────────

// // Hitung total HPP dari items
// const hppTotal = items.reduce((sum, item) => {
//   const variant = resolvedVariants.find(v => v.id === item.variantId);
//   return sum + (Number(variant?.cost ?? 0) * item.quantity);
// }, 0);
//
// await generateSaleJournals({
//   storeId,
//   saleId:        createdSale.id,
//   total:         totalAfterDiscount,
//   hpp:           hppTotal,
//   paymentMethod: paymentMethod,
//   date:          createdSale.createdAt,
//   saleNumber:    createdSale.saleNumber,
// });


// ─────────────────────────────────────────────────────────────────────────────
// PATCH UNTUK register-store action
//
// Setelah store berhasil dibuat, seed default CoA:
// ─────────────────────────────────────────────────────────────────────────────

// import { seedDefaultAccounts } from '@/modules/accounting/lib/journal-engine';
//
// const newStore = await db.store.create({ data: { ... } });
// await seedDefaultAccounts(newStore.id);


// ─────────────────────────────────────────────────────────────────────────────
// CATATAN: paymentMethod di cashflow
//
// Cashflow model saat ini tidak punya field paymentMethod.
// Untuk mapping jurnal yang lebih akurat, tambahkan field ini ke schema:
//
// model Cashflow {
//   ...
//   paymentMethod String @default("CASH") // CASH | BANK | OTHER
//   ...
// }
//
// Dan tambahkan ke form cashflow-dialog.tsx serta cashflow action.
// Ini opsional — tanpa ini, semua cashflow diasumsikan CASH (akun 1001).
// ─────────────────────────────────────────────────────────────────────────────
