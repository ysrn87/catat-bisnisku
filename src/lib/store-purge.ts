import type { Prisma } from '@prisma/client';

/**
 * Semua model yang punya kolom storeId. Dicek terhadap schema.prisma oleh
 * scripts/check-store-delete-coverage.mjs: tambah model ber-storeId baru
 * → WAJIB ditambahkan di sini dan di purgeStoreData() di bawah.
 */
export const STORE_SCOPED_MODELS = [
  'JournalEntry', 'Cashflow', 'StockMovement', 'Payment', 'Sale',
  'ProductVariant', 'Product', 'Category', 'Account', 'Customer',
  'StoreUser', 'StoreStaff', 'StaffInvitation', 'StoreSetting',
  'UpgradePayment', 'StoreLimitOverride',
  'Combo', 'ComboItem', 'ComboItemVariant', 'SaleCombo',
  'StorePaymentAccount',
] as const;

/** Model tanpa storeId yang terhapus lewat induknya (dihapus eksplisit di bawah). */
export const INDIRECT_MODELS = ['SaleItem', 'PointHistory', 'PaymentSplit'] as const;

/**
 * Hapus SEMUA data satu toko di dalam transaksi yang dipanggil pemanggil.
 *
 * Kenapa eksplisit dan berurutan, bukan sekadar store.delete()?
 * Beberapa relasi bersifat RESTRICT (Payment→Store, Sale→StoreStaff,
 * SaleItem/StockMovement→ProductVariant, JournalEntry→Account). RESTRICT di
 * PostgreSQL dicek langsung, jadi cascade lewat jalur lain bisa gagal
 * tergantung urutan. Urutan di bawah: anak dulu, induk belakangan.
 *
 * Akun User (owner, staff, member) TIDAK dihapus; hanya tautan ke toko ini
 * (StoreStaff, StoreUser) yang dihapus.
 */
export async function purgeStoreData(
  tx: Prisma.TransactionClient,
  store: { id: string; slug: string }
): Promise<void> {
  const storeId = store.id;

  await tx.comboItemVariant.deleteMany({ where: { storeId } });
  await tx.comboItem.deleteMany({ where: { storeId } });
  await tx.combo.deleteMany({ where: { storeId } });
  await tx.journalEntry.deleteMany({ where: { storeId } });
  await tx.cashflow.deleteMany({ where: { storeId } });
  await tx.stockMovement.deleteMany({ where: { storeId } });
  await tx.paymentSplit.deleteMany({ where: { payment: { storeId } } });
  await tx.payment.deleteMany({ where: { storeId } });
  await tx.pointHistory.deleteMany({ where: { storeUser: { storeId } } });
  await tx.saleItem.deleteMany({ where: { sale: { storeId } } });
  await tx.saleCombo.deleteMany({ where: { storeId } });
  await tx.sale.deleteMany({ where: { storeId } });
  await tx.productVariant.deleteMany({ where: { storeId } });
  await tx.product.deleteMany({ where: { storeId } });
  await tx.category.deleteMany({ where: { storeId } });
  await tx.account.deleteMany({ where: { storeId } });
  await tx.customer.deleteMany({ where: { storeId } });
  await tx.storeUser.deleteMany({ where: { storeId } });
  await tx.storeStaff.deleteMany({ where: { storeId } });
  await tx.staffInvitation.deleteMany({ where: { storeId } });
  await tx.storeSetting.deleteMany({ where: { storeId } });
  await tx.upgradePayment.deleteMany({ where: { storeId } });
  await tx.storeLimitOverride.deleteMany({ where: { storeId } });
  await tx.storePaymentAccount.deleteMany({ where: { storeId } });

  // Tahan slug agar tidak langsung dipakai toko lain
  await tx.deletedStoreSlug.upsert({
    where:  { slug: store.slug },
    create: { slug: store.slug },
    update: { deletedAt: new Date() },
  });

  await tx.store.delete({ where: { id: storeId } });

  // Verifikasi bersih. Typed Record: menambah nama ke STORE_SCOPED_MODELS tanpa
  // menambah hitungannya di sini akan gagal saat compile.
  const residue: Record<(typeof STORE_SCOPED_MODELS)[number], number> = {
    JournalEntry:       await tx.journalEntry.count({ where: { storeId } }),
    Cashflow:           await tx.cashflow.count({ where: { storeId } }),
    StockMovement:      await tx.stockMovement.count({ where: { storeId } }),
    Payment:            await tx.payment.count({ where: { storeId } }),
    Sale:               await tx.sale.count({ where: { storeId } }),
    ProductVariant:     await tx.productVariant.count({ where: { storeId } }),
    Product:            await tx.product.count({ where: { storeId } }),
    Category:           await tx.category.count({ where: { storeId } }),
    Account:            await tx.account.count({ where: { storeId } }),
    Customer:           await tx.customer.count({ where: { storeId } }),
    StoreUser:          await tx.storeUser.count({ where: { storeId } }),
    StoreStaff:         await tx.storeStaff.count({ where: { storeId } }),
    StaffInvitation:    await tx.staffInvitation.count({ where: { storeId } }),
    StoreSetting:       await tx.storeSetting.count({ where: { storeId } }),
    UpgradePayment:     await tx.upgradePayment.count({ where: { storeId } }),
    StoreLimitOverride: await tx.storeLimitOverride.count({ where: { storeId } }),
    Combo:              await tx.combo.count({ where: { storeId } }),
    ComboItem:          await tx.comboItem.count({ where: { storeId } }),
    ComboItemVariant:   await tx.comboItemVariant.count({ where: { storeId } }),
    SaleCombo:          await tx.saleCombo.count({ where: { storeId } }),
    StorePaymentAccount: await tx.storePaymentAccount.count({ where: { storeId } }),
  };
  const leftovers = Object.entries(residue).filter(([, n]) => n > 0);
  if (leftovers.length > 0 || (await tx.store.count({ where: { id: storeId } })) > 0) {
    // Melempar membatalkan seluruh transaksi → tidak ada yang terhapus.
    throw new Error(`[store-purge] data tersisa: ${JSON.stringify(leftovers)}`);
  }
}
