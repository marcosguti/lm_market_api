-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "gatewayControl" TEXT,
ADD COLUMN "gatewayStatus" TEXT,
ADD COLUMN "gatewayVoucher" TEXT,
ADD COLUMN "gatewayRawResponse" JSONB,
ADD COLUMN "verifiedAutomatically" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "payerCid" TEXT,
ADD COLUMN "payerPhone" TEXT,
ADD COLUMN "payerBankCode" TEXT;
