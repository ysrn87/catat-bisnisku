-- Buat tabel payments untuk idempotency webhook Midtrans
CREATE TABLE IF NOT EXISTS "payments" (
  "id"          TEXT NOT NULL,
  "orderId"     TEXT NOT NULL,
  "storeId"     TEXT NOT NULL,
  "status"      TEXT NOT NULL,
  "grossAmount" DECIMAL(10,2) NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_orderId_key" UNIQUE ("orderId"),
  CONSTRAINT "payments_storeId_fkey" FOREIGN KEY ("storeId")
    REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "payments_storeId_idx" ON "payments"("storeId");
