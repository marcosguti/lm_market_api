-- AlterTable
ALTER TABLE "Store" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Store_active_idx" ON "Store"("active");
