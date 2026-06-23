-- Part 1 of 2: Add new StoreRole enum values.
--
-- Must be a standalone migration because PostgreSQL requires ALTER TYPE ... ADD VALUE
-- to be committed before the new value can be used in the same session.
-- Prisma wraps each file in its own transaction, so splitting into two files
-- ensures the enum value is committed before Part 2 uses it.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TYPE "StoreRole" ADD VALUE IF NOT EXISTS 'CUSTOMER';
