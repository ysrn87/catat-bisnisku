-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "saleComboId" TEXT;

-- CreateTable
CREATE TABLE "combos" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "combos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combo_items" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "comboId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "combo_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combo_item_variants" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "comboItemId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "combo_item_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_combos" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "comboId" TEXT,
    "name" TEXT NOT NULL,
    "packagePrice" DECIMAL(10,2) NOT NULL,
    "itemsTotal" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_combos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "combos_storeId_idx" ON "combos"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "combos_storeId_name_key" ON "combos"("storeId", "name");

-- CreateIndex
CREATE INDEX "combo_items_storeId_idx" ON "combo_items"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "combo_items_comboId_productId_key" ON "combo_items"("comboId", "productId");

-- CreateIndex
CREATE INDEX "combo_item_variants_storeId_idx" ON "combo_item_variants"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "combo_item_variants_comboItemId_variantId_key" ON "combo_item_variants"("comboItemId", "variantId");

-- CreateIndex
CREATE INDEX "sale_combos_saleId_idx" ON "sale_combos"("saleId");

-- CreateIndex
CREATE INDEX "sale_combos_storeId_idx" ON "sale_combos"("storeId");

-- CreateIndex
CREATE INDEX "sale_items_saleComboId_idx" ON "sale_items"("saleComboId");

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleComboId_fkey" FOREIGN KEY ("saleComboId") REFERENCES "sale_combos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combos" ADD CONSTRAINT "combos_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "combos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_item_variants" ADD CONSTRAINT "combo_item_variants_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_item_variants" ADD CONSTRAINT "combo_item_variants_comboItemId_fkey" FOREIGN KEY ("comboItemId") REFERENCES "combo_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_item_variants" ADD CONSTRAINT "combo_item_variants_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_combos" ADD CONSTRAINT "sale_combos_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_combos" ADD CONSTRAINT "sale_combos_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_combos" ADD CONSTRAINT "sale_combos_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "combos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
