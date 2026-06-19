CREATE TABLE "Banner" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT NOT NULL,
    "description" VARCHAR(300),
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX "Banner_active_idx" ON "Banner"("active");
