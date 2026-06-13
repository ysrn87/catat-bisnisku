/**
 * CLEAN DATABASE SCRIPT
 * 
 * This script will DELETE ALL DATA from the database except admin user credentials.
 * 
 * What will be DELETED:
 * - All sales and sale items
 * - All non-admin customers/members
 * - All products and variants
 * - All stock movements
 * - All cashflow records
 * - All point history
 * - All settings (except preserved ones)
 * - All non-member customers
 * 
 * What will be PRESERVED:
 * - Admin user account (email, password, role)
 * - Critical settings (if any)
 */

import { PrismaClient, Role } from '@prisma/client';
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

async function cleanDatabase() {
  console.log('\n⚠️  CLEAN DATABASE SCRIPT ⚠️\n');
  console.log('This will DELETE ALL DATA except admin user credentials!\n');
  console.log('What will be deleted:');
  console.log('  ❌ All sales and transactions');
  console.log('  ❌ All non-admin users (members and customers)');
  console.log('  ❌ All products and variants');
  console.log('  ❌ All stock movements');
  console.log('  ❌ All cashflow records');
  console.log('  ❌ All point history');
  console.log('  ❌ All non-member customers');
  console.log('  ❌ All settings\n');
  console.log('What will be preserved:');
  console.log('  ✅ Admin user credentials\n');

  const answer = await question('Type "DELETE EVERYTHING" to confirm: ');

  if (answer !== 'DELETE EVERYTHING') {
    console.log('\n❌ Operation cancelled. No changes made.\n');
    rl.close();
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log('\n🔄 Starting database cleanup...\n');

  try {
    // Get admin user before deletion
    const admins = await prisma.user.findMany({
      where: { role: Role.ADMINISTRATOR },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        password: true,
        role: true,
        birthday: true,
        address: true,
        photoUrl: true,
      },
    });

    if (admins.length === 0) {
      console.log('⚠️  Warning: No admin users found!');
      const proceed = await question('Continue anyway? (yes/no): ');
      if (proceed.toLowerCase() !== 'yes') {
        console.log('\n❌ Operation cancelled.\n');
        rl.close();
        await prisma.$disconnect();
        process.exit(0);
      }
    } else {
      console.log(`✅ Found ${admins.length} admin user(s) to preserve:`);
      admins.forEach((admin) => {
        console.log(`   - ${admin.name} (${admin.email || admin.phone})`);
      });
      console.log('');
    }

    await prisma.$transaction(async (tx) => {
      // Delete in correct order to respect foreign key constraints

      console.log('🗑️  Deleting sale items...');
      await tx.saleItem.deleteMany();

      console.log('🗑️  Deleting sales...');
      await tx.sale.deleteMany();

      console.log('🗑️  Deleting point history...');
      await tx.pointHistory.deleteMany();

      console.log('🗑️  Deleting stock movements...');
      await tx.stockMovement.deleteMany();

      console.log('🗑️  Deleting product variants...');
      await tx.productVariant.deleteMany();

      console.log('🗑️  Deleting products...');
      await tx.product.deleteMany();

      console.log('🗑️  Deleting cashflow records...');
      await tx.cashflow.deleteMany();

      console.log('🗑️  Deleting non-member customers...');
      await tx.customer.deleteMany();

      console.log('🗑️  Deleting non-admin users...');
      await tx.user.deleteMany({
        where: {
          role: { not: Role.ADMINISTRATOR },
        },
      });

      console.log('🗑️  Deleting settings...');
      await tx.settings.deleteMany();

      console.log('🔄 Resetting admin points to 0...');
      await tx.user.updateMany({
        where: { role: Role.ADMINISTRATOR },
        data: { points: 0 },
      });
    });

    console.log('\n✅ Database cleaned successfully!');
    console.log('✅ Admin credentials preserved.\n');

    // Show preserved admin info
    const preservedAdmins = await prisma.user.findMany({
      where: { role: Role.ADMINISTRATOR },
      select: {
        name: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    console.log('Preserved admin accounts:');
    preservedAdmins.forEach((admin) => {
      console.log(`  ✅ ${admin.name} - ${admin.email || admin.phone}`);
    });
    console.log('');
  } catch (error) {
    console.error('\n❌ Error cleaning database:', error);
    console.log('Database may be in an inconsistent state. Please check manually.\n');
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

cleanDatabase()
  .then(() => {
    console.log('✅ Script completed successfully.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
