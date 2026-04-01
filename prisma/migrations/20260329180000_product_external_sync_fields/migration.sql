ALTER TABLE "Product" ADD COLUMN     "initialBalance" INTEGER,
ADD COLUMN     "adminMovements" INTEGER,
ADD COLUMN     "salesToday" INTEGER,
ADD COLUMN     "totalStock" INTEGER,
ADD COLUMN     "inventoryValueBs" DECIMAL(14,2),
ADD COLUMN     "marginPct" DECIMAL(10,2);

CREATE UNIQUE INDEX "Product_internalCode_key" ON "Product"("internalCode");

CREATE INDEX "Product_description_idx" ON "Product"("description");

CREATE INDEX "Product_marca_idx" ON "Product"("marca");
