// Menjadikan (atau mencabut) seorang user sebagai superadmin.
//   node scripts/make-superadmin.mjs email@contoh.com
//   node scripts/make-superadmin.mjs email@contoh.com --revoke
// Butuh DATABASE_URL di environment (mis. dari .env: `node --env-file=.env scripts/...`).
import { PrismaClient } from '@prisma/client';

const email  = process.argv[2]?.trim().toLowerCase();
const revoke = process.argv.includes('--revoke');

if (!email || email.startsWith('--')) {
  console.error('Pemakaian: node scripts/make-superadmin.mjs <email> [--revoke]');
  process.exit(1);
}

const db = new PrismaClient();
try {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User dengan email ${email} tidak ditemukan.`);
    process.exit(1);
  }
  if (!revoke && !user.emailVerified) {
    console.error('Email user ini belum diverifikasi. Verifikasi dulu sebelum dijadikan superadmin.');
    process.exit(1);
  }
  await db.user.update({ where: { id: user.id }, data: { isSuperAdmin: !revoke } });
  console.log(revoke ? `Akses superadmin dicabut dari ${email}.` : `${email} sekarang superadmin.`);
  if (revoke) console.log('Catatan: session lama berakhir otomatis di halaman superadmin karena dicek ulang ke DB.');
} finally {
  await db.$disconnect();
}
