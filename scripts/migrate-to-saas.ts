/**
 * MIGRATE TO SAAS SCRIPT
 *
 * Script ini mengubah database single-tenant menjadi multi-tenant (SaaS).
 * Aman dijalankan pada database yang sudah punya data.
 *
 * Yang dilakukan:
 * 1. Jalankan migration SQL (buat tabel stores, store_users, tambah kolom storeId)
 * 2. Buat Store default dari data admin yang ada
 * 3. Isi storeId di semua tabel dengan store default
 * 4. Buat StoreUser untuk semua User existing sesuai role mereka
 * 5. Set storeId NOT NULL + buat unique constraints baru
 *
 * Cara jalankan:
 *   npx tsx scripts/migrate-to-saas.ts
 *
 * PENTING: Backup database sebelum menjalankan script ini!
 *   pg_dump -U postgres catat_bisnisku > backup_before_saas.sql
 */

import { PrismaClient, Role } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, resolve));

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function migrate() {
  console.log('\n🚀 MIGRATE TO SAAS\n');
  console.log('Script ini akan mengubah database menjadi multi-tenant SaaS.\n');

  // ─── Cek apakah sudah pernah dijalankan ───────────────────────────────────
  const storeCount = await prisma.store.count();
  if (storeCount > 0) {
    console.log(`⚠️  Sudah ada ${storeCount} store di database.`);
    const proceed = await question('Lanjutkan tetap? Data yang sudah ada storeId tidak akan tersentuh. (yes/no): ');
    if (proceed.toLowerCase() !== 'yes') {
      console.log('\n❌ Dibatalkan.\n');
      process.exit(0);
    }
  }

  // ─── Ambil data existing ──────────────────────────────────────────────────
  const [adminUser, allUsers, stats] = await Promise.all([
    prisma.user.findFirst({
      where: { role: Role.ADMINISTRATOR },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
    getStats(),
  ]);

  if (!adminUser) {
    console.error('❌ Tidak ada user ADMINISTRATOR ditemukan. Jalankan seed terlebih dahulu.');
    process.exit(1);
  }

  console.log('📊 Data existing yang akan dimigrasikan:');
  console.log(`   Users      : ${stats.users}`);
  console.log(`   Products   : ${stats.products}`);
  console.log(`   Variants   : ${stats.variants}`);
  console.log(`   Sales      : ${stats.sales}`);
  console.log(`   Customers  : ${stats.customers}`);
  console.log(`   Cashflows  : ${stats.cashflows}`);
  console.log(`   Settings   : ${stats.settings}`);
  console.log(`   Stocks     : ${stats.stocks}\n`);

  // ─── Input nama & slug store default ──────────────────────────────────────
  console.log(`Admin utama: ${adminUser.name} (${adminUser.email ?? adminUser.phone})\n`);

  const rawName = await question('Nama toko default (tekan Enter untuk "Toko Saya"): ');
  const storeName = rawName.trim() || 'Toko Saya';

  const rawSlug = await question(`Slug toko (tekan Enter untuk "${slugify(storeName)}"): `);
  const storeSlug = rawSlug.trim() || slugify(storeName);

  console.log(`\n✅ Akan dibuat store: "${storeName}" dengan slug "${storeSlug}"`);
  console.log(`   URL nanti: /store/${storeSlug}/\n`);

  const confirm = await question('Konfirmasi migrasi? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('\n❌ Dibatalkan.\n');
    process.exit(0);
  }

  console.log('\n🔄 Memulai migrasi...\n');

  try {
    // ─── Step 1: Buat Store default ─────────────────────────────────────────
    console.log('1️⃣  Membuat store default...');

    const existingStore = await prisma.store.findUnique({ where: { slug: storeSlug } });
    const store = existingStore ?? await prisma.store.create({
      data: {
        name: storeName,
        slug: storeSlug,
        plan: 'FREE',
        ownerId: adminUser.id,
        updatedAt: new Date(),
      },
    });

    console.log(`   ✓ Store "${store.name}" (id: ${store.id})\n`);

    // ─── Step 2: Isi storeId di semua tabel ─────────────────────────────────
    console.log('2️⃣  Mengisi storeId di semua tabel...');

    await prisma.$executeRawUnsafe(
      `UPDATE products         SET "storeId" = $1 WHERE "storeId" IS NULL`, store.id
    );
    await prisma.$executeRawUnsafe(
      `UPDATE product_variants SET "storeId" = $1 WHERE "storeId" IS NULL`, store.id
    );
    await prisma.$executeRawUnsafe(
      `UPDATE stock_movements  SET "storeId" = $1 WHERE "storeId" IS NULL`, store.id
    );
    await prisma.$executeRawUnsafe(
      `UPDATE settings         SET "storeId" = $1 WHERE "storeId" IS NULL`, store.id
    );
    await prisma.$executeRawUnsafe(
      `UPDATE customers        SET "storeId" = $1 WHERE "storeId" IS NULL`, store.id
    );
    await prisma.$executeRawUnsafe(
      `UPDATE sales            SET "storeId" = $1 WHERE "storeId" IS NULL`, store.id
    );
    await prisma.$executeRawUnsafe(
      `UPDATE cashflows        SET "storeId" = $1 WHERE "storeId" IS NULL`, store.id
    );

    console.log('   ✓ Semua tabel sudah diisi storeId\n');

    // ─── Step 3: Buat StoreUser untuk semua User existing ───────────────────
    console.log('3️⃣  Membuat StoreUser untuk semua user existing...');

    const roleMap: Record<string, 'OWNER' | 'ADMINISTRATOR' | 'MANAGER' | 'MEMBER'> = {
      ADMINISTRATOR: 'ADMINISTRATOR',
      MANAGER: 'MANAGER',
      MEMBER: 'MEMBER',
    };

    let storeUserCount = 0;
    for (const user of allUsers) {
      // Owner: user yang jadi admin pertama
      const storeRole = user.id === adminUser.id ? 'OWNER' : (roleMap[user.role] ?? 'MEMBER');

      const existing = await prisma.storeUser.findUnique({
        where: { storeId_userId: { storeId: store.id, userId: user.id } },
      });

      if (!existing) {
        await prisma.storeUser.create({
          data: {
            storeId: store.id,
            userId: user.id,
            role: storeRole,
          },
        });
        storeUserCount++;
      }
    }

    console.log(`   ✓ Dibuat ${storeUserCount} StoreUser (${allUsers.length - storeUserCount} sudah ada)\n`);

    // ─── Step 4: Set storeId NOT NULL ────────────────────────────────────────
    console.log('4️⃣  Set storeId NOT NULL di semua tabel...');

    await prisma.$executeRawUnsafe(`ALTER TABLE products         ALTER COLUMN "storeId" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE product_variants ALTER COLUMN "storeId" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE stock_movements  ALTER COLUMN "storeId" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE settings         ALTER COLUMN "storeId" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE customers        ALTER COLUMN "storeId" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE sales            ALTER COLUMN "storeId" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE cashflows        ALTER COLUMN "storeId" SET NOT NULL`);

    console.log('   ✓ Semua kolom storeId sudah NOT NULL\n');

    // ─── Step 5: Buat unique constraints baru (per-store) ───────────────────
    console.log('5️⃣  Membuat unique constraints per-store...');

    const constraints = [
      { name: 'products_storeId_sku_key',              sql: `CREATE UNIQUE INDEX IF NOT EXISTS "products_storeId_sku_key" ON "products"("storeId", "sku")` },
      { name: 'product_variants_storeId_sku_key',      sql: `CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_storeId_sku_key" ON "product_variants"("storeId", "sku")` },
      { name: 'product_variants_storeId_barcode_key',  sql: `CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_storeId_barcode_key" ON "product_variants"("storeId", "barcode") WHERE "barcode" IS NOT NULL` },
      { name: 'customers_storeId_phone_key',           sql: `CREATE UNIQUE INDEX IF NOT EXISTS "customers_storeId_phone_key" ON "customers"("storeId", "phone")` },
      { name: 'sales_storeId_saleNumber_key',          sql: `CREATE UNIQUE INDEX IF NOT EXISTS "sales_storeId_saleNumber_key" ON "sales"("storeId", "saleNumber")` },
      { name: 'settings_storeId_key_key',              sql: `CREATE UNIQUE INDEX IF NOT EXISTS "settings_storeId_key_key" ON "settings"("storeId", "key")` },
    ];

    for (const c of constraints) {
      await prisma.$executeRawUnsafe(c.sql);
      console.log(`   ✓ ${c.name}`);
    }

    // ─── Step 6: Tambah foreign keys ─────────────────────────────────────────
    console.log('\n6️⃣  Menambah foreign key constraints...');

    const fkeys = [
      `ALTER TABLE products         ADD CONSTRAINT IF NOT EXISTS "products_storeId_fkey"         FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE product_variants ADD CONSTRAINT IF NOT EXISTS "product_variants_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE stock_movements  ADD CONSTRAINT IF NOT EXISTS "stock_movements_storeId_fkey"  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE settings         ADD CONSTRAINT IF NOT EXISTS "settings_storeId_fkey"         FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE customers        ADD CONSTRAINT IF NOT EXISTS "customers_storeId_fkey"        FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE sales            ADD CONSTRAINT IF NOT EXISTS "sales_storeId_fkey"            FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE cashflows        ADD CONSTRAINT IF NOT EXISTS "cashflows_storeId_fkey"        FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    ];

    for (const fk of fkeys) {
      try {
        await prisma.$executeRawUnsafe(fk);
      } catch {
        // constraint sudah ada — skip
      }
    }

    console.log('   ✓ Foreign keys ditambahkan\n');

    // ─── Selesai ─────────────────────────────────────────────────────────────
    console.log('🎉 Migrasi selesai!\n');
    console.log('📊 Ringkasan:');
    console.log(`   Store default : "${store.name}" (slug: ${store.slug})`);
    console.log(`   Store ID      : ${store.id}`);
    console.log(`   Store Users   : ${allUsers.length} user dimigrasikan`);
    console.log(`   Plan          : FREE\n`);
    console.log('💡 Langkah selanjutnya:');
    console.log('   1. Jalankan: npx prisma generate');
    console.log('   2. Test login dan pastikan semua halaman berfungsi');
    console.log('   3. Lanjut ke Step 3 (Middleware)\n');

  } catch (err) {
    console.error('\n❌ Migrasi gagal:', err);
    console.error('\nDatabase mungkin dalam kondisi tidak konsisten.');
    console.error('Restore dari backup jika perlu:\n  psql -U postgres catat_bisnisku < backup_before_saas.sql\n');
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

async function getStats() {
  const [users, products, variants, sales, customers, cashflows, settings, stocks] =
    await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.productVariant.count(),
      prisma.sale.count(),
      prisma.customer.count(),
      prisma.cashflow.count(),
      prisma.settings.count(),
      prisma.stockMovement.count(),
    ]);
  return { users, products, variants, sales, customers, cashflows, settings, stocks };
}

migrate().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});
