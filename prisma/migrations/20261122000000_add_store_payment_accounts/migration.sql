-- CreateEnum
CREATE TYPE "PaymentAccountType" AS ENUM ('BANK', 'EWALLET', 'QRIS');

-- CreateTable
CREATE TABLE "store_payment_accounts" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "PaymentAccountType" NOT NULL,
    "provider" TEXT NOT NULL,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "qrisImageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_payment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_payment_accounts_storeId_type_isActive_idx" ON "store_payment_accounts"("storeId", "type", "isActive");

-- AddForeignKey
ALTER TABLE "store_payment_accounts" ADD CONSTRAINT "store_payment_accounts_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
