// Memastikan SEMUA model ber-storeId di schema.prisma terdaftar di
// src/lib/store-purge.ts. Jalankan sebelum deploy / di CI:
//   node scripts/check-store-delete-coverage.mjs
// Exit code 1 bila ada model yang belum tercakup (data akan tertinggal saat toko dihapus).
import { readFileSync } from 'node:fs';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const purge  = readFileSync('src/lib/store-purge.ts', 'utf8');

const inSchema = new Set();
for (const m of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
  const [, name, body] = m;
  if (name === 'Store') continue;
  if (/^\s*storeId\s/m.test(body)) inSchema.add(name);
}

const listMatch = purge.match(/STORE_SCOPED_MODELS = \[([\s\S]*?)\] as const/);
if (!listMatch) {
  console.error('STORE_SCOPED_MODELS tidak ditemukan di src/lib/store-purge.ts');
  process.exit(1);
}
const inPurge = new Set([...listMatch[1].matchAll(/'(\w+)'/g)].map((x) => x[1]));

const missing = [...inSchema].filter((n) => !inPurge.has(n));
const stale   = [...inPurge].filter((n) => !inSchema.has(n));

if (missing.length || stale.length) {
  if (missing.length) console.error('BELUM tercakup penghapusan toko:', missing.join(', '));
  if (stale.length)   console.error('Terdaftar tapi tidak ada storeId di schema:', stale.join(', '));
  process.exit(1);
}
console.log(`OK: ${inSchema.size} model ber-storeId tercakup oleh purgeStoreData().`);
