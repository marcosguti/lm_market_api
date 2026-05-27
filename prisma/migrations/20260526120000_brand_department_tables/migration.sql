-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- Add nullable FK columns; keep legacy Product.brand / Product.department
ALTER TABLE "Product" ADD COLUMN "brandId" TEXT;
ALTER TABLE "Product" ADD COLUMN "departmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");
CREATE INDEX "Brand_name_idx" ON "Brand"("name");

CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE INDEX "Department_name_idx" ON "Department"("name");

CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");
CREATE INDEX "Product_departmentId_idx" ON "Product"("departmentId");

-- AddForeignKey (nullable)
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
