-- CreateTable
CREATE TABLE "deleted_store_slugs" (
    "slug" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_store_slugs_pkey" PRIMARY KEY ("slug")
);
