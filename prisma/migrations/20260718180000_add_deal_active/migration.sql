-- AlterTable
ALTER TABLE "Deal" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Deal_active_idx" ON "Deal"("active");
