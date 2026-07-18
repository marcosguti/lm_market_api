-- AlterTable
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "note" VARCHAR(100);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentMethodConfig" (
    "method" "PaymentMethod" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "information" TEXT,
    "placeholder" VARCHAR(200),
    "noteEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("method")
);

-- Seed default payment method configs
INSERT INTO "PaymentMethodConfig" ("method", "active", "information", "placeholder", "noteEnabled", "updatedAt")
VALUES
  ('cash', true, NULL, 'Toma una foto legible del billete', true, CURRENT_TIMESTAMP),
  ('zelle', true, NULL, NULL, true, CURRENT_TIMESTAMP),
  ('mobilePayment', true, NULL, NULL, false, CURRENT_TIMESTAMP),
  ('binance', true, NULL, NULL, true, CURRENT_TIMESTAMP)
ON CONFLICT ("method") DO NOTHING;
