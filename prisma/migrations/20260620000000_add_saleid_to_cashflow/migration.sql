-- Add saleId to track auto-generated cashflow entries from sales (prevents manual edit/delete)
ALTER TABLE "cashflows" ADD COLUMN "saleId" TEXT;

-- Add time field (HH:MM string) for manual cashflow entries
ALTER TABLE "cashflows" ADD COLUMN "time" TEXT;
