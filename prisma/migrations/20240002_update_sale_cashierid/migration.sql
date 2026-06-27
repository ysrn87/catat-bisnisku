-- Migration 2: Update Sale.cashierId agar FK ke store_staff, bukan users
-- Jalankan SETELAH migration 1 selesai dan diverifikasi.

-- 2a. Drop FK lama (Sale.cashierId → users)
ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "sales_cashierId_fkey";

-- 2b. Update nilai cashierId di sales:
--     ganti dari users.id → store_staff.id yang sesuai (storeId + userId matching)
UPDATE "sales" s
SET "cashierId" = ss."id"
FROM "store_staff" ss
WHERE ss."userId" = s."cashierId"
  AND ss."storeId" = s."storeId";

-- 2c. Pasang FK baru (Sale.cashierId → store_staff)
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashierId_fkey"
    FOREIGN KEY ("cashierId") REFERENCES "store_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verifikasi: tidak boleh ada cashierId yang tidak ditemukan di store_staff
-- SELECT COUNT(*) FROM "sales" s
-- LEFT JOIN "store_staff" ss ON ss."id" = s."cashierId"
-- WHERE ss."id" IS NULL;
