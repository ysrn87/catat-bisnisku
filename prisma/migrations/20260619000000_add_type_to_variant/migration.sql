-- Add type field to product_variants, inheriting from the parent product
ALTER TABLE "product_variants" ADD COLUMN "type" "ProductType" NOT NULL DEFAULT 'READY_STOCK';

-- Carry forward the existing product-level type to all its variants
UPDATE "product_variants" pv
SET "type" = p."type"
FROM "products" p
WHERE pv."productId" = p."id";
