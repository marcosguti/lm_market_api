CREATE TABLE "Deal" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "description" VARCHAR(300),
    "imageUrl" TEXT NOT NULL,
    "startDate" TIMESTAMP NOT NULL,
    "endDate" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX "Deal_startDate_endDate_idx" ON "Deal"("startDate", "endDate");