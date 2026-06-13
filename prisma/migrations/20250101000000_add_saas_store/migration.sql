-- Migration: add_saas_store
-- Tambah model Store, StoreUser, kolom storeId ke semua tabel,
-- dan update unique constraints dari global ke per-store.

-- ─── Enums baru ───────────────────────────────────────────────────────────────

CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');
CREATE TYPE "StoreRole" AS ENUM ('OWNER', 'ADMINISTRATOR', 'MANAGER', 'MEMBER');

-- ─── Tabel stores ─────────────────────────────────────────────────────────────

CREATE TABLE "stores" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "plan"      "Plan" NOT NULL DEFAULT 'FREE',
    "ownerId"   TEXT NOT NULL,
    "logoUrl"   TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

ALTER TABLE "stores"
    ADD CONSTRAINT "stores_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Tabel store_users ────────────────────────────────────────────────────────

CREATE TABLE "store_users" (
    "id"        TEXT NOT NULL,
    "storeId"   TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "role"      "StoreRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "store_users_storeId_userId_key" ON "store_users"("storeId", "userId");

ALTER TABLE "store_users"
    ADD CONSTRAINT "store_users_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "store_users"
    ADD CONSTRAINT "store_users_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Drop constraint lama yang mungkin masih ada dari db push ───────────────────
-- (Aman dijalankan berkali-kali karena pakai IF EXISTS)

ALTER TABLE "settings"         DROP CONSTRAINT IF EXISTS "settings_key_key";
DROP INDEX IF EXISTS "settings_key_key";
ALTER TABLE "products"         DROP CONSTRAINT IF EXISTS "products_sku_key";
DROP INDEX IF EXISTS "products_sku_key";
ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "product_variants_sku_key";
DROP INDEX IF EXISTS "product_variants_sku_key";
ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "product_variants_barcode_key";
DROP INDEX IF EXISTS "product_variants_barcode_key";
ALTER TABLE "customers"        DROP CONSTRAINT IF EXISTS "customers_phone_key";
DROP INDEX IF EXISTS "customers_phone_key";
ALTER TABLE "sales"            DROP CONSTRAINT IF EXISTS "sales_saleNumber_key";
DROP INDEX IF EXISTS "sales_saleNumber_key";

-- ─── Tambah storeId ke tabel existing (nullable dulu untuk migrasi data) ──────

ALTER TABLE "products"         ADD COLUMN "storeId" TEXT;
ALTER TABLE "product_variants" ADD COLUMN "storeId" TEXT;
ALTER TABLE "stock_movements"  ADD COLUMN "storeId" TEXT;
ALTER TABLE "settings"         ADD COLUMN "storeId" TEXT;
ALTER TABLE "customers"        ADD COLUMN "storeId" TEXT;
ALTER TABLE "sales"            ADD COLUMN "storeId" TEXT;
ALTER TABLE "cashflows"        ADD COLUMN "storeId" TEXT;

-- ─── Hapus unique constraints lama (akan diganti dengan per-store) ─────────────

-- products.sku
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_sku_key";

-- product_variants.sku dan barcode
ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "product_variants_sku_key";
ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "product_variants_barcode_key";

-- customers.phone
ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_phone_key";

-- sales.saleNumber
ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "sales_saleNumber_key";

-- settings.key
ALTER TABLE "settings" DROP CONSTRAINT IF EXISTS "settings_key_key";

-- ─── [DATA MIGRATION — diisi oleh migrate-to-saas.ts] ────────────────────────
-- Script migrate-to-saas.ts akan:
-- 1. Buat Store default dari data admin yang ada
-- 2. Isi storeId di semua row dengan store default tersebut
-- 3. Buat StoreUser untuk semua User existing

-- ─── Set storeId NOT NULL setelah data diisi ──────────────────────────────────
-- Dijalankan oleh migrate-to-saas.ts setelah data selesai diisi

-- ALTER TABLE "products"         ALTER COLUMN "storeId" SET NOT NULL;
-- ALTER TABLE "product_variants" ALTER COLUMN "storeId" SET NOT NULL;
-- ALTER TABLE "stock_movements"  ALTER COLUMN "storeId" SET NOT NULL;
-- ALTER TABLE "settings"         ALTER COLUMN "storeId" SET NOT NULL;
-- ALTER TABLE "customers"        ALTER COLUMN "storeId" SET NOT NULL;
-- ALTER TABLE "sales"            ALTER COLUMN "storeId" SET NOT NULL;
-- ALTER TABLE "cashflows"        ALTER COLUMN "storeId" SET NOT NULL;

-- ─── Unique constraints baru (per-store) ──────────────────────────────────────
-- Juga dijalankan setelah data selesai diisi oleh migrate-to-saas.ts

-- CREATE UNIQUE INDEX "products_storeId_sku_key"            ON "products"("storeId", "sku");
-- CREATE UNIQUE INDEX "product_variants_storeId_sku_key"    ON "product_variants"("storeId", "sku");
-- CREATE UNIQUE INDEX "product_variants_storeId_barcode_key" ON "product_variants"("storeId", "barcode") WHERE "barcode" IS NOT NULL;
-- CREATE UNIQUE INDEX "customers_storeId_phone_key"         ON "customers"("storeId", "phone");
-- CREATE UNIQUE INDEX "sales_storeId_saleNumber_key"        ON "sales"("storeId", "saleNumber");
-- CREATE UNIQUE INDEX "settings_storeId_key_key"            ON "settings"("storeId", "key");

-- ─── Foreign keys untuk storeId (setelah NOT NULL) ───────────────────────────

-- ALTER TABLE "products"         ADD CONSTRAINT "products_storeId_fkey"         FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE "stock_movements"  ADD CONSTRAINT "stock_movements_storeId_fkey"  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE "settings"         ADD CONSTRAINT "settings_storeId_fkey"         FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE "customers"        ADD CONSTRAINT "customers_storeId_fkey"        FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE "sales"            ADD CONSTRAINT "sales_storeId_fkey"            FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE "cashflows"        ADD CONSTRAINT "cashflows_storeId_fkey"        FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
