-- Rename OrderStatus enum values from Spanish to English camelCase
ALTER TYPE "OrderStatus" RENAME VALUE 'pendiente' TO 'pending';
ALTER TYPE "OrderStatus" RENAME VALUE 'pagoConfirmado' TO 'paymentConfirmed';
ALTER TYPE "OrderStatus" RENAME VALUE 'preparando' TO 'preparing';
ALTER TYPE "OrderStatus" RENAME VALUE 'listaParaReparto' TO 'readyForDelivery';
ALTER TYPE "OrderStatus" RENAME VALUE 'enReparto' TO 'outForDelivery';
ALTER TYPE "OrderStatus" RENAME VALUE 'entregada' TO 'delivered';
ALTER TYPE "OrderStatus" RENAME VALUE 'cancelada' TO 'cancelled';

-- PaymentMethod did not exist in prior migrations; create it with final values
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'zelle', 'mobilePayment', 'binance');

ALTER TABLE "Order"
ADD COLUMN "paymentMethod" "PaymentMethod",
ADD COLUMN "paymentReference" TEXT,
ADD COLUMN "paymentDate" TIMESTAMP(3),
ADD COLUMN "paymentScreenshotUrl" TEXT;

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "screenshotUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
