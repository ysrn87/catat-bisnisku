-- Part 2 of 2: Unify Customer table into User + StoreUser.
--
-- Requires 20260622000000_add_customer_enum to be applied first
-- so that 'CUSTOMER' is a committed enum value.

-- ── StoreUser.points (per-store loyalty balance) ─────────────────────────────
ALTER TABLE "store_users" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 0;

-- ── User.password nullable (CUSTOMER accounts don't need a login yet) ────────
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- ── Sale.customerId nullable (ensure) ────────────────────────────────────────
ALTER TABLE "sales" ALTER COLUMN "customerId" DROP NOT NULL;

-- ── Migrate every Customer row → User + StoreUser, re-point Sales ────────────
DO $$
DECLARE
  c         RECORD;
  target_id TEXT;
BEGIN
  FOR c IN
    SELECT id, name, phone, address, "storeId", "createdAt"
    FROM   customers
  LOOP
    -- Check if a User already exists with this phone
    SELECT id INTO target_id FROM users WHERE phone = c.phone LIMIT 1;

    IF target_id IS NULL THEN
      -- No User yet → create a passwordless User for this customer
      target_id := uuid_generate_v4()::TEXT;

      INSERT INTO users (
        id, name, phone, address, password, email, birthday, "photoUrl",
        role, "createdAt", "updatedAt"
      ) VALUES (
        target_id,
        c.name,
        c.phone,
        c.address,
        NULL,       -- no password; they don't have a login yet
        NULL,
        NULL,
        NULL,
        'MEMBER',   -- global Role enum (lowest privilege)
        c."createdAt",
        c."createdAt"
      );
    END IF;

    -- Add CUSTOMER StoreUser for this store
    -- ON CONFLICT: if they're already a StoreUser here (e.g. as MEMBER), skip
    INSERT INTO store_users (id, "storeId", "userId", role, points, "createdAt")
    VALUES (
      uuid_generate_v4()::TEXT,
      c."storeId",
      target_id,
      'CUSTOMER',
      0,
      c."createdAt"
    )
    ON CONFLICT ("storeId", "userId") DO NOTHING;

    -- Re-point any Sales that referenced this Customer row → the User
    UPDATE sales
    SET
      "customerId"          = target_id,
      "nonMemberCustomerId" = NULL
    WHERE "nonMemberCustomerId" = c.id;

  END LOOP;
END;
$$;

-- ── Migrate User.points → StoreUser.points using PointHistory ────────────────
-- Sum net points per (userId, storeId) from PointHistory and write to StoreUser.
-- GREATEST(0, ...) prevents negative cached balances from bad data.
UPDATE store_users su
SET    points = GREATEST(0, sub.net)
FROM (
  SELECT "userId", "storeId", SUM(points) AS net
  FROM   point_history
  WHERE  "storeId" IS NOT NULL
  GROUP  BY "userId", "storeId"
) sub
WHERE su."userId" = sub."userId"
  AND su."storeId" = sub."storeId";

-- ── Drop Sale.nonMemberCustomerId ─────────────────────────────────────────────
ALTER TABLE "sales" DROP COLUMN IF EXISTS "nonMemberCustomerId";

-- ── Drop Customer table ───────────────────────────────────────────────────────
DROP TABLE IF EXISTS "customers";

-- ── Drop User.points ──────────────────────────────────────────────────────────
ALTER TABLE "users" DROP COLUMN IF EXISTS "points";
