-- Add CASHIER role: a staff tier that can operate the POS but cannot
-- manage inventory, customers, finance, or settings.
ALTER TYPE "StoreRole" ADD VALUE 'CASHIER';
ALTER TYPE "Role" ADD VALUE 'CASHIER';
