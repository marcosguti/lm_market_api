-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "storeId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_storeId_idx" ON "User"("storeId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_storeId_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
