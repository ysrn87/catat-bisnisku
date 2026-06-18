# Panduan Implementasi SaaS — catatbisnisku

Panduan ini mencakup semua langkah untuk mengubah app single-tenant menjadi multi-tenant SaaS dengan path prefix (`/[slug]/...`).

**Prasyarat:** Sudah punya backup database sebelum mulai.

```powershell
pg_dump -U postgres catat_bisnisku > backup_before_saas.sql
```

---

## Fase 1 — Persiapan Codebase

### 1.1 — Hapus dead code

```powershell
del src\components\sales\manager-sales-table.tsx
```

### 1.2 — Buat folder `[slug]` di Windows

Kurung kotak harus dibuat manual karena Windows Explorer kadang bermasalah:

```powershell
mkdir "src\app\[slug]"
mkdir "src\app\[slug]\admin"
mkdir "src\app\[slug]\admin\inventory\products"
mkdir "src\app\[slug]\admin\inventory\stock"
mkdir "src\app\[slug]\admin\inventory\reports"
mkdir "src\app\[slug]\admin\finance\cashflow"
mkdir "src\app\[slug]\admin\finance\reports"
mkdir "src\app\[slug]\admin\transactions\sales"
mkdir "src\app\[slug]\admin\transactions\customers"
mkdir "src\app\[slug]\admin\transactions\recap"
mkdir "src\app\[slug]\admin\settings\points"
mkdir "src\app\[slug]\admin\settings\profile"
mkdir "src\app\[slug]\manager"
mkdir "src\app\[slug]\manager\inventory\products"
mkdir "src\app\[slug]\manager\inventory\stock"
mkdir "src\app\[slug]\manager\transactions\sales"
mkdir "src\app\[slug]\manager\transactions\customers"
mkdir "src\app\[slug]\manager\transactions\recap"
mkdir "src\app\[slug]\member\purchases"
mkdir "src\app\[slug]\upgrade"
mkdir "src\app\store-select"
mkdir "src\app\register-store"
mkdir "src\app\api\store\resolve"
mkdir "src\app\api\store\plan"
mkdir "src\components\layouts"
mkdir "src\components\plan"
mkdir "src\types"
```

### 1.3 — Extract zip dan copy file

```powershell
Expand-Archive -Path catatbisnisku-saas-update.zip -DestinationPath .\saas-update
Copy-Item -Recurse -Force .\saas-update\catatbisnisku\* .
```

> **Catatan:** Kalau folder `[slug]` tidak ter-copy dengan benar, copy manual file per file sesuai daftar di bawah.

---

## Fase 2 — Daftar File yang Di-copy

### Replace file yang sudah ada

```
package.json
next.config.ts
.env.example
prisma/schema.prisma
src/auth.ts
src/middleware.ts                                          ← baru
src/components/navigation.tsx
src/components/layouts/tab-layout.tsx                     ← baru
src/app/page.tsx
src/app/login/page.tsx
src/app/admin/inventory/layout.tsx
src/app/admin/finance/layout.tsx
src/app/admin/transactions/layout.tsx
src/app/admin/settings/layout.tsx
src/app/admin/inventory/products/page.tsx
src/app/admin/transactions/sales/page.tsx
src/app/admin/transactions/customers/page.tsx
src/app/admin/transactions/recap/page.tsx
src/app/manager/inventory/layout.tsx
src/app/manager/transactions/layout.tsx
src/app/manager/inventory/products/page.tsx
src/app/manager/transactions/sales/page.tsx
src/app/manager/transactions/customers/page.tsx
src/app/manager/transactions/recap/page.tsx
src/components/customers/customers-table.tsx
src/actions/settings.ts
src/actions/products.ts
src/actions/stock.ts
src/actions/cashflow.ts
src/actions/customers.ts
src/actions/sales.ts
src/actions/manager-actions.ts
scripts/seed-admin-only.ts
```

### File baru

```
src/types/next-auth.d.ts
src/lib/store-context.ts
src/app/store-select/page.tsx
src/app/register-store/page.tsx
src/app/api/store/resolve/route.ts
src/app/api/store/plan/route.ts
src/app/[slug]/page.tsx
src/app/[slug]/admin/layout.tsx
src/app/[slug]/admin/page.tsx
src/app/[slug]/admin/inventory/layout.tsx
src/app/[slug]/admin/inventory/products/page.tsx
src/app/[slug]/admin/inventory/stock/page.tsx
src/app/[slug]/admin/inventory/reports/page.tsx
src/app/[slug]/admin/finance/layout.tsx
src/app/[slug]/admin/finance/cashflow/page.tsx
src/app/[slug]/admin/finance/reports/page.tsx
src/app/[slug]/admin/transactions/layout.tsx
src/app/[slug]/admin/transactions/sales/page.tsx
src/app/[slug]/admin/transactions/customers/page.tsx
src/app/[slug]/admin/transactions/recap/page.tsx
src/app/[slug]/admin/settings/layout.tsx
src/app/[slug]/admin/settings/points/page.tsx
src/app/[slug]/admin/settings/profile/page.tsx
src/app/[slug]/manager/layout.tsx
src/app/[slug]/manager/page.tsx
src/app/[slug]/manager/inventory/layout.tsx
src/app/[slug]/manager/inventory/products/page.tsx
src/app/[slug]/manager/inventory/stock/page.tsx
src/app/[slug]/manager/transactions/layout.tsx
src/app/[slug]/manager/transactions/sales/page.tsx
src/app/[slug]/manager/transactions/customers/page.tsx
src/app/[slug]/manager/transactions/recap/page.tsx
src/app/[slug]/member/layout.tsx
src/app/[slug]/member/page.tsx
src/app/[slug]/member/purchases/page.tsx
src/app/[slug]/upgrade/page.tsx
src/components/plan/plan-badge.tsx
src/components/plan/plan-gate.tsx
src/components/plan/plan-limit-bar.tsx
scripts/migrate-to-saas.ts
prisma/migrations/20250101000000_add_saas_store/migration.sql
```

---

## Fase 3 — Setup Environment

### 3.1 — Update `.env`

Tambah 2 variabel baru ke file `.env` lokal kamu:

```env
# Generate dengan:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

INTERNAL_API_SECRET="isi-dengan-random-string-panjang"
SUPER_ADMIN_SECRET="isi-dengan-random-string-lain-yang-panjang"
```

---

## Fase 4 — Database Migration

### 4.1 — Jalankan migration SQL

```powershell
psql -U postgres -d catat_bisnisku -f prisma/migrations/20250101000000_add_saas_store/migration.sql
```

> Error "already exists" di output itu normal jika kamu sudah pernah jalankan `db push` sebelumnya — abaikan saja.

### 4.2 — Generate Prisma client

```powershell
npx prisma generate
```

Kalau ada error validasi schema, pastikan `prisma/schema.prisma` sudah menggunakan versi terbaru dari zip.

### 4.3 — Migrasi data existing ke SaaS

Script ini interaktif — akan tanya nama toko dan slug:

```powershell
npm run db:migrate:saas
```

Contoh output yang diharapkan:

```
🚀 MIGRATE TO SAAS

📊 Data existing yang akan dimigrasikan:
   Users      : 3
   Products   : 15
   ...

Admin utama: Administrator (admin@example.com)

Nama toko default (tekan Enter untuk "Toko Saya"): Toko Berkah
Slug toko (tekan Enter untuk "toko-berkah"): toko-berkah

✅ Akan dibuat store: "Toko Berkah" dengan slug "toko-berkah"

Konfirmasi migrasi? (yes/no): yes

🔄 Memulai migrasi...

1️⃣  Membuat store default...
   ✓ Store "Toko Berkah" (id: clxxx...)

2️⃣  Mengisi storeId di semua tabel...
   ✓ Semua tabel sudah diisi storeId

3️⃣  Membuat StoreUser untuk semua user existing...
   ✓ Dibuat 3 StoreUser

4️⃣  Set storeId NOT NULL di semua tabel...
   ✓ Semua kolom storeId sudah NOT NULL

5️⃣  Membuat unique constraints per-store...
   ✓ products_storeId_sku_key
   ...

6️⃣  Menambah foreign key constraints...
   ✓ Foreign keys ditambahkan

🎉 Migrasi selesai!
```

> **Untuk fresh install** (database kosong, belum ada data): skip langkah 4.1 dan 4.3, langsung jalankan `npm run db:seed`.

---

## Fase 5 — Install Dependencies

```powershell
# Hapus cmdk dari node_modules (sudah dihapus dari package.json)
npm install
```

---

## Fase 6 — Test Lokal

### 6.1 — Jalankan dev server

```powershell
npm run dev
```

### 6.2 — Urutan test

**A. Landing page**

Buka `http://localhost:3000` — harus muncul halaman publik dengan hero, fitur, dan pricing.

**B. Register toko baru**

Buka `http://localhost:3000/register-store` dan isi form:
- Nama toko: `Toko Test`
- Slug: `toko-test` (auto-generate dari nama)
- Nama pemilik, telepon, password

Setelah submit → redirect ke `/login?registered=true&slug=toko-test`

**C. Login**

Login dengan akun yang baru didaftarkan → redirect ke `/store-select` → lalu ke `/{slug}/admin`

**D. Login dengan akun existing (setelah migrasi)**

```
Email    : admin@example.com
Password : admin123
```

Setelah login → `/store-select` → pilih toko → `/toko-berkah/admin`

**E. Cek semua route**

```
http://localhost:3000/toko-berkah/admin
http://localhost:3000/toko-berkah/admin/inventory/products
http://localhost:3000/toko-berkah/admin/inventory/stock
http://localhost:3000/toko-berkah/admin/transactions/sales
http://localhost:3000/toko-berkah/admin/finance/cashflow
http://localhost:3000/toko-berkah/admin/settings/points
http://localhost:3000/toko-berkah/upgrade
```

> Ganti `toko-berkah` dengan slug yang kamu buat saat migrasi.

**F. Test plan limit**

Tambah produk hingga mendekati 50 → PlanLimitBar di halaman products harus berubah kuning lalu merah.

**G. Test isolasi antar toko**

1. Daftarkan toko kedua via `/register-store` dengan akun berbeda
2. Login dengan akun toko pertama → hanya bisa lihat data toko pertama
3. Login dengan akun toko kedua → hanya bisa lihat data toko kedua

---

## Fase 7 — Bersih-bersih (setelah semua test OK)

Route lama (`/admin`, `/manager`, `/member`) masih ada tapi sudah tidak dipakai. Hapus setelah yakin semua berfungsi:

```powershell
# Hapus route lama
Remove-Item -Recurse -Force src\app\admin
Remove-Item -Recurse -Force src\app\manager
Remove-Item -Recurse -Force src\app\member
```

> **Jangan hapus dulu** sebelum semua route `[slug]` sudah ditest dan berjalan normal.

---

## Fase 8 — Upgrade Plan (Manual)

Saat ada pelanggan yang mau upgrade ke PRO, jalankan di terminal:

```powershell
# PowerShell
$body = '{"slug":"toko-berkah","plan":"PRO","secret":"your-super-admin-secret"}'
Invoke-WebRequest -Uri "http://localhost:3000/api/store/plan" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

# Atau dengan curl
curl -X POST http://localhost:3000/api/store/plan `
  -H "Content-Type: application/json" `
  -d '{\"slug\":\"toko-berkah\",\"plan\":\"PRO\",\"secret\":\"your-super-admin-secret\"}'
```

Untuk downgrade ke FREE:

```powershell
$body = '{"slug":"toko-berkah","plan":"FREE","secret":"your-super-admin-secret"}'
Invoke-WebRequest -Uri "http://localhost:3000/api/store/plan" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

---

## Troubleshooting

### ❌ `getStoreContext` throws error

```
[getStoreContext] storeId tidak ditemukan di headers
```

Artinya request tidak melewati middleware. Pastikan:
- `src/middleware.ts` sudah di-copy ke root `src/`
- Pattern URL mengikuti format `/{slug}/admin/...` atau `/{slug}/manager/...`
- `INTERNAL_API_SECRET` sudah diset di `.env`

### ❌ Slug tidak bisa diakses, selalu redirect ke `/not-found`

Cek apakah store dengan slug tersebut ada di database:

```powershell
psql -U postgres -d catat_bisnisku -c "SELECT id, name, slug, plan FROM stores;"
```

### ❌ `npx prisma generate` error setelah copy schema

Pastikan tidak ada konflik tipe — schema baru menambah `Plan`, `StoreRole` enum. Kalau error duplicate enum:

```powershell
# Drop enum lama yang mungkin sudah terbuat dari db push sebelumnya
psql -U postgres -d catat_bisnisku -c "DROP TYPE IF EXISTS \"Plan\" CASCADE;"
psql -U postgres -d catat_bisnisku -c "DROP TYPE IF EXISTS \"StoreRole\" CASCADE;"
# Lalu jalankan migration SQL ulang
psql -U postgres -d catat_bisnisku -f prisma/migrations/20250101000000_add_saas_store/migration.sql
npx prisma generate
```

### ❌ Login berhasil tapi redirect ke `/store-select` lalu balik ke login

Artinya user tidak punya `StoreUser` di database. Jalankan ulang migrasi:

```powershell
npm run db:migrate:saas
```

Atau tambah manual via Prisma Studio:

```powershell
npx prisma studio
```

Buka tabel `store_users` → tambah row dengan `storeId`, `userId`, dan `role: OWNER`.

### ❌ Error TypeScript di `src/actions/`

Setelah copy file actions baru, TypeScript mungkin komplain karena `requireStoreAccess` belum dikenali. Pastikan:
- `src/lib/store-context.ts` sudah ada
- Jalankan `npx prisma generate` ulang
- Restart TypeScript server di VS Code: `Ctrl+Shift+P` → `TypeScript: Restart TS Server`

---

## Ringkasan Alur Data SaaS

```
User buka /toko-berkah/admin/inventory/products
          ↓
[middleware.ts]
  Extract slug "toko-berkah"
  Fetch /api/store/resolve?slug=toko-berkah
  Inject x-store-id ke headers
          ↓
[admin/layout.tsx]
  Cek session → redirect /login kalau belum login
  Cek StoreUser → redirect /unauthorized kalau tidak punya akses
  Render Navigation dengan storeSlug + storePlan
          ↓
[inventory/products/page.tsx]
  getStoreContext() → ambil storeId dari headers
  db.product.findMany({ where: { storeId } })
  Render hanya produk milik toko ini
```
