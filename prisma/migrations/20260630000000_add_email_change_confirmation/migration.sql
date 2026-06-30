-- Tambah kolom newEmail (nullable) ke email_verifications.
-- newEmail = NULL    → token verifikasi awal saat registrasi
-- newEmail = terisi  → token konfirmasi ganti email (lihat requestEmailChangeAction)
ALTER TABLE "email_verifications" ADD COLUMN "newEmail" TEXT;
