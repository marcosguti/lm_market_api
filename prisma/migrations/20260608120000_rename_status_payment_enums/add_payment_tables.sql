-- Create PaymentMethod enum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'zelle', 'mobilePayment', 'binance');

-- Add payment columns to Order table
ALTER TABLE "Order" ADD COLUMN "paymentMethod" "PaymentMethod";
ALTER TABLE "Order" ADD COLUMN "paymentReference" TEXT;
ALTER TABLE "Order" ADD COLUMN "paymentDate" TIMESTAMP;
ALTER TABLE "Order" ADD COLUMN "paymentScreenshotUrl" TEXT;

-- Create Payment table
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT uuid(),
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

-- Create index on Order status for performance
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_deliveryUserId_idx" ON "Order"("deliveryUserId");