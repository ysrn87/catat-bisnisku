-- Add subscriptionExpiresAt to stores table
ALTER TABLE "stores" ADD COLUMN "subscriptionExpiresAt" TIMESTAMP(3);
