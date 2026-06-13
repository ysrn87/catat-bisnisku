-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN "barcode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_barcode_key" ON "product_variants"("barcode");