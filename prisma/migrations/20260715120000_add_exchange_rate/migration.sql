-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "pair" VARCHAR(16) NOT NULL,
    "rate" DECIMAL(14,8) NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_pair_key" ON "ExchangeRate"("pair");

-- CreateIndex
CREATE INDEX "ExchangeRate_pair_idx" ON "ExchangeRate"("pair");

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "exchangeRate" DECIMAL(14,8);

-- Backfill historical non-pending orders with env fallback default (600)
UPDATE "Order"
SET "exchangeRate" = 600
WHERE "exchangeRate" IS NULL
  AND "status" NOT IN ('pending', 'cancelled');
