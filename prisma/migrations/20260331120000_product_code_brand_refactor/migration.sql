ALTER TABLE "Product" RENAME COLUMN "internalCode" TO "code";

ALTER TABLE "Product" RENAME COLUMN "marca" TO "brand";

ALTER TABLE "Product" DROP COLUMN "barCode";

DROP INDEX IF EXISTS "Product_internalCode_key";
DROP INDEX IF EXISTS "Product_name_marca_internalCode_idx";
DROP INDEX IF EXISTS "Product_marca_idx";

CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");
CREATE INDEX "Product_name_brand_code_idx" ON "Product"("name", "brand", "code");
CREATE INDEX "Product_brand_idx" ON "Product"("brand");
