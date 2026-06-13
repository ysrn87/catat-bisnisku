/**
 * SEED SCRIPT (SaaS version)
 *
 * Membuat:
 * - 1 admin user
 * - 1 store default
 * - 1 StoreUser (admin sebagai OWNER)
 * - 3 system settings untuk store tersebut
 *
 * Cara jalankan:
 *   npx tsx scripts/seed-admin-only.ts
 */

import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Konfigurasi — ubah sesuai kebutuhan ──────────────────────────────────────
const ADMIN_EMAIL    = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';         // ⚠️ Ganti setelah login pertama!
const ADMIN_NAME     = 'Administrator';
const ADMIN_PHONE    = '+6281234567890';
const ADMIN_ADDRESS  = 'Jakarta, Indonesia';
const ADMIN_BIRTHDAY = new Date('1990-01-01');

const STORE_NAME = 'Toko Saya';
const STORE_SLUG = 'toko-saya';
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database (SaaS)...\n');

  // ─── Admin user ─────────────────────────────────────────────────────────────
  console.log('👤 Membuat admin user...');
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      password: hashedPassword,
      name: ADMIN_NAME,
      phone: ADMIN_PHONE,
      address: ADMIN_ADDRESS,
      role: Role.ADMINISTRATOR,
      birthday: ADMIN_BIRTHDAY,
    },
    create: {
      email: ADMIN_EMAIL,
      password: hashedPassword,
      name: ADMIN_NAME,
      phone: ADMIN_PHONE,
      address: ADMIN_ADDRESS,
      role: Role.ADMINISTRATOR,
      birthday: ADMIN_BIRTHDAY,
      points: 0,
    },
  });

  console.log(`   ✓ Admin: ${admin.email} (id: ${admin.id})`);

  // ─── Store default ───────────────────────────────────────────────────────────
  console.log('\n🏪 Membuat store default...');

  const store = await prisma.store.upsert({
    where: { slug: STORE_SLUG },
    update: { name: STORE_NAME },
    create: {
      name: STORE_NAME,
      slug: STORE_SLUG,
      plan: 'FREE',
      ownerId: admin.id,
      updatedAt: new Date(),
    },
  });

  console.log(`   ✓ Store: "${store.name}" (slug: ${store.slug})`);

  // ─── StoreUser: admin sebagai OWNER ──────────────────────────────────────────
  console.log('\n🔗 Menghubungkan admin ke store...');

  await prisma.storeUser.upsert({
    where: { storeId_userId: { storeId: store.id, userId: admin.id } },
    update: { role: 'OWNER' },
    create: {
      storeId: store.id,
      userId: admin.id,
      role: 'OWNER',
    },
  });

  console.log(`   ✓ StoreUser: ${admin.name} → OWNER`);

  // ─── Settings per store ──────────────────────────────────────────────────────
  console.log('\n⚙️  Membuat settings store...');

  const settingsList = [
    {
      key: 'pointsConversionRate',
      value: '1000',
      description: 'Konversi poin ke Rupiah (1 poin = X Rupiah)',
    },
    {
      key: 'minPointsForRedemption',
      value: '10',
      description: 'Minimum poin yang bisa ditukar',
    },
    {
      key: 'maxPointsPerTransaction',
      value: '1000',
      description: 'Maksimum poin yang bisa ditukar dalam satu transaksi',
    },
  ];

  for (const s of settingsList) {
    await prisma.settings.upsert({
      where: { storeId_key: { storeId: store.id, key: s.key } },
      update: {},
      create: {
        storeId: store.id,
        key: s.key,
        value: s.value,
        description: s.description,
        updatedAt: new Date(),
      },
    });
    console.log(`   ✓ ${s.key} = ${s.value}`);
  }

  // ─── Selesai ─────────────────────────────────────────────────────────────────
  console.log('\n🎉 Seeding selesai!\n');
  console.log('📊 Ringkasan:');
  console.log('   • 1 admin user');
  console.log('   • 1 store default');
  console.log('   • 1 store member (owner)');
  console.log('   • 3 system settings\n');
  console.log('🔐 Kredensial login:');
  console.log(`   Email    : ${ADMIN_EMAIL}`);
  console.log(`   Password : ${ADMIN_PASSWORD}`);
  console.log(`   Store    : /${STORE_SLUG}/\n`);
  console.log('⚠️  Ganti password setelah login pertama!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding gagal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
