-- Migration 1: Buat tabel store_staff dan enum StaffRole
-- Jalankan ini PERTAMA, sebelum migration 2 dan 3.
-- Aman dijalankan di Neon tanpa shadow database.

-- 1a. Buat enum baru StaffRole
CREATE TYPE "StaffRole" AS ENUM ('OWNER', 'ADMINISTRATOR', 'MANAGER', 'CASHIER');

-- 1b. Buat tabel store_staff
CREATE TABLE "store_staff" (
    "id"        TEXT NOT NULL,
    "storeId"   TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "role"      "StaffRole" NOT NULL DEFAULT 'CASHIER',
    "joinedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_staff_pkey" PRIMARY KEY ("id")
);

-- 1c. Unique constraint dan indexes
CREATE UNIQUE INDEX "store_staff_storeId_userId_key" ON "store_staff"("storeId", "userId");

-- 1d. Foreign keys
ALTER TABLE "store_staff" ADD CONSTRAINT "store_staff_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "store_staff" ADD CONSTRAINT "store_staff_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 1e. Migrasi data: copy semua staff dari store_users ke store_staff
--     (semua row yang rolenya bukan MEMBER)
INSERT INTO "store_staff" ("id", "storeId", "userId", "role", "joinedAt")
SELECT
    gen_random_uuid()::text,
    "storeId",
    "userId",
    "role"::"StaffRole",
    "joinedAt"
FROM "store_users"
WHERE "role" IN ('OWNER', 'ADMINISTRATOR', 'MANAGER', 'CASHIER');

-- Verifikasi: pastikan jumlah row store_staff sesuai
-- SELECT COUNT(*) FROM "store_staff";
-- SELECT COUNT(*) FROM "store_users" WHERE "role" != 'MEMBER';
