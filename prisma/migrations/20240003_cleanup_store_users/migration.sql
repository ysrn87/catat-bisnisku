-- Migration 3: Bersihkan store_users — hapus semua baris non-MEMBER, drop kolom role
-- Jalankan SETELAH migration 1 dan 2 selesai dan diverifikasi.

-- 3a. Hapus baris non-MEMBER dari store_users (sudah dipindah ke store_staff)
DELETE FROM "store_users" WHERE "role" != 'MEMBER';

-- 3b. Drop kolom role dari store_users (tidak diperlukan lagi, selalu MEMBER)
ALTER TABLE "store_users" DROP COLUMN IF EXISTS "role";

-- 3c. Drop enum StoreRole (tidak dipakai lagi)
--     CATATAN: Neon tidak support DROP TYPE IF EXISTS — pakai BEGIN/EXCEPTION
DO $$
BEGIN
    DROP TYPE "StoreRole";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Verifikasi akhir
-- SELECT COUNT(*) FROM "store_users";     -- hanya member
-- SELECT COUNT(*) FROM "store_staff";     -- semua staff
-- \d store_users                          -- kolom role sudah hilang
