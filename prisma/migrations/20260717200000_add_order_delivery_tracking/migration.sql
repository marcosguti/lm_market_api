-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryLatitude" DECIMAL(10,7);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryLongitude" DECIMAL(10,7);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrderDeliveryTracking" (
    "orderId" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracyMeters" DOUBLE PRECISION,
    "headingDegrees" DOUBLE PRECISION,
    "speedMps" DOUBLE PRECISION,
    "deviceRecordedAt" TIMESTAMP(3),
    "serverReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trackingSessionId" TEXT,
    "deviceId" TEXT,
    "routeGeometry" JSONB,
    "distanceMeters" DOUBLE PRECISION,
    "etaSeconds" INTEGER,
    "routeCalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderDeliveryTracking_pkey" PRIMARY KEY ("orderId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderDeliveryTracking_serverReceivedAt_idx" ON "OrderDeliveryTracking"("serverReceivedAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrderDeliveryTracking_orderId_fkey'
  ) THEN
    ALTER TABLE "OrderDeliveryTracking"
      ADD CONSTRAINT "OrderDeliveryTracking_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
