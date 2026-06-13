/**
 * RESET DATABASE SCRIPT
 * 
 * This script will DELETE ALL TRANSACTION DATA but keep all user credentials.
 * 
 * What will be DELETED:
 * - All sales and sale items
 * - All stock movements
 * - All cashflow records
 * - All point history
 * 
 * What will be PRESERVED:
 * - All user accounts (admin, manager, members)
 * - All non-member customers
 * - All products and variants
 * 
 * What will be RESET:
 * - User points → 0
 * - All product variant stock → 0
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function resetDatabase() {
  console.log('\n🔄 RESET DATABASE SCRIPT\n');
  console.log('This will DELETE ALL TRANSACTION DATA but keep users and products!\n');
  console.log('What will be deleted:');
  console.log('  ❌ All sales and sale items');
  console.log('  ❌ All stock movements');
  console.log('  ❌ All cashflow records');
  console.log('  ❌ All point history\n');
  console.log('What will be reset:');
  console.log('  🔁 User points → 0');
  console.log('  🔁 All product variant stock → 0\n');
  console.log('What will be preserved:');
  console.log('  ✅ All user accounts (admin, manager, members)');
  console.log('  ✅ All non-member customers');
  console.log('  ✅ All products and variants\n');

  const answer = await question('Type "RESET TRANSACTIONS" to confirm: ');

  if (answer !== 'RESET TRANSACTIONS') {
    console.log('\n❌ Operation cancelled. No changes made.\n');
    rl.close();
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log('\n🔄 Starting database reset...\n');

  try {
    // Get statistics before deletion
    const stats = await getStatistics();
    console.log('Current database statistics:');
    console.log(`  📊 Users: ${stats.users}`);
    console.log(`  📊 Non-member customers: ${stats.customers}`);
    console.log(`  📊 Products: ${stats.products}`);
    console.log(`  📊 Product variants: ${stats.variants} (stock will be reset to 0)`);
    console.log(`  📊 Sales: ${stats.sales}`);
    console.log(`  📊 Stock movements: ${stats.stockMovements}`);
    console.log(`  📊 Cashflow records: ${stats.cashflows}`);
    console.log(`  📊 Point history records: ${stats.pointHistory}\n`);

    const finalConfirm = await question(`Delete ${stats.sales} sales and reset all stocks to 0? (yes/no): `);
    
    if (finalConfirm.toLowerCase() !== 'yes') {
      console.log('\n❌ Operation cancelled.\n');
      rl.close();
      await prisma.$disconnect();
      process.exit(0);
    }

    const deleteSettings = await question('Delete all settings too? (yes/no): ');

    await prisma.$transaction(async (tx) => {
      // Delete in correct order to respect foreign key constraints

      console.log('🗑️  Deleting sale items...');
      const deletedSaleItems = await tx.saleItem.deleteMany();
      console.log(`   ✓ Deleted ${deletedSaleItems.count} sale items`);

      console.log('🗑️  Deleting sales...');
      const deletedSales = await tx.sale.deleteMany();
      console.log(`   ✓ Deleted ${deletedSales.count} sales`);

      console.log('🗑️  Deleting point history...');
      const deletedPointHistory = await tx.pointHistory.deleteMany();
      console.log(`   ✓ Deleted ${deletedPointHistory.count} point history records`);

      console.log('🗑️  Deleting stock movements...');
      const deletedStockMovements = await tx.stockMovement.deleteMany();
      console.log(`   ✓ Deleted ${deletedStockMovements.count} stock movements`);

      console.log('🗑️  Deleting cashflow records...');
      const deletedCashflows = await tx.cashflow.deleteMany();
      console.log(`   ✓ Deleted ${deletedCashflows.count} cashflow records`);

      console.log('🔄 Resetting user points to 0...');
      const updatedUsers = await tx.user.updateMany({
        data: { points: 0 },
      });
      console.log(`   ✓ Reset points for ${updatedUsers.count} users`);

      console.log('🔄 Resetting all product variant stock to 0...');
      const updatedVariants = await tx.productVariant.updateMany({
        data: { stock: 0 },
      });
      console.log(`   ✓ Reset stock for ${updatedVariants.count} product variants`);

      // Optional: Delete settings
      if (deleteSettings.toLowerCase() === 'yes') {
        console.log('🗑️  Deleting settings...');
        const deletedSettings = await tx.settings.deleteMany();
        console.log(`   ✓ Deleted ${deletedSettings.count} settings`);
      } else {
        console.log('   ✓ Settings preserved');
      }
    });

    console.log('\n✅ Database reset successfully!\n');

    // Show preserved data
    const finalStats = await getStatistics();
    console.log('Preserved data:');
    console.log(`  ✅ Users: ${finalStats.users}`);
    console.log(`  ✅ Non-member customers: ${finalStats.customers}`);
    console.log(`  ✅ Products: ${finalStats.products}`);
    console.log(`  ✅ Product variants: ${finalStats.variants} (all stock reset to 0)\n`);

    console.log('Transaction data after reset:');
    console.log(`  📊 Sales: ${finalStats.sales}`);
    console.log(`  📊 Stock movements: ${finalStats.stockMovements}`);
    console.log(`  📊 Cashflow records: ${finalStats.cashflows}`);
    console.log(`  📊 Point history: ${finalStats.pointHistory}\n`);
  } catch (error) {
    console.error('\n❌ Error resetting database:', error);
    console.log('Database may be in an inconsistent state. Please check manually.\n');
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

async function getStatistics() {
  const [
    users,
    customers,
    products,
    variants,
    sales,
    stockMovements,
    cashflows,
    pointHistory,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.customer.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.sale.count(),
    prisma.stockMovement.count(),
    prisma.cashflow.count(),
    prisma.pointHistory.count(),
  ]);

  return {
    users,
    customers,
    products,
    variants,
    sales,
    stockMovements,
    cashflows,
    pointHistory,
  };
}

resetDatabase()
  .then(() => {
    console.log('✅ Script completed successfully.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });