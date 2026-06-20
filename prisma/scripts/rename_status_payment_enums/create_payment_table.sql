CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "orderId" TEXT NOT NULL UNIQUE,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT NOT NULL,
    "paidAt" TIMESTAMP NOT NULL,
    "screenshotUrl" TEXT,
    "verifiedAt" TIMESTAMP,
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE
);