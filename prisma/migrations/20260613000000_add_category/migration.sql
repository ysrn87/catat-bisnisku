-- Migration: add_category
-- Tambah tabel categories dan kolom categoryId ke products

CREATE TABLE "categories" (
    "id"        TEXT NOT NULL,
    "storeId"   TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "color"     TEXT,
    "icon"      TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- Unique: nama kategori unik per store
CREATE UNIQUE INDEX "categories_storeId_name_key" ON "categories"("storeId", "name");

-- Foreign key ke stores
ALTER TABLE "categories"
    ADD CONSTRAINT "categories_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Tambah categoryId ke products (nullable)
ALTER TABLE "products" ADD COLUMN "categoryId" TEXT;

-- Foreign key categoryId → categories
ALTER TABLE "products"
    ADD CONSTRAINT "products_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
