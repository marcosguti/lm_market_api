/*
  Warnings:

  - You are about to drop the column `adminMovements` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `cost` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `initialBalance` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `inventoryValueBs` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `marginPct` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `salesToday` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `totalStock` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "adminMovements",
DROP COLUMN "cost",
DROP COLUMN "initialBalance",
DROP COLUMN "inventoryValueBs",
DROP COLUMN "marginPct",
DROP COLUMN "price",
DROP COLUMN "salesToday",
DROP COLUMN "totalStock";

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "externalBranchCode" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStore" (
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStore_pkey" PRIMARY KEY ("productId","storeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_externalBranchCode_key" ON "Store"("externalBranchCode");

-- CreateIndex
CREATE INDEX "Store_externalBranchCode_idx" ON "Store"("externalBranchCode");

-- CreateIndex
CREATE INDEX "ProductStore_storeId_idx" ON "ProductStore"("storeId");

-- CreateIndex
CREATE INDEX "Order_storeId_idx" ON "Order"("storeId");

-- AddForeignKey
ALTER TABLE "ProductStore" ADD CONSTRAINT "ProductStore_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStore" ADD CONSTRAINT "ProductStore_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
