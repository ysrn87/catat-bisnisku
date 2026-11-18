-- CreateTable
CREATE TABLE "plan_limit_configs" (
    "plan" "Plan" NOT NULL,
    "products" INTEGER,
    "variantsPerProduct" INTEGER,
    "managers" INTEGER,
    "cashiers" INTEGER,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_limit_configs_pkey" PRIMARY KEY ("plan")
);

-- CreateTable
CREATE TABLE "store_limit_overrides" (
    "storeId" TEXT NOT NULL,
    "products" INTEGER,
    "variantsPerProduct" INTEGER,
    "managers" INTEGER,
    "cashiers" INTEGER,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_limit_overrides_pkey" PRIMARY KEY ("storeId")
);

-- CreateTable
CREATE TABLE "superadmin_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "superadmin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "superadmin_audit_logs_createdAt_idx" ON "superadmin_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "store_limit_overrides" ADD CONSTRAINT "store_limit_overrides_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
