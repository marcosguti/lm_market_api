-- CreateTable
CREATE TABLE "SyncJobStatus" (
    "id" TEXT NOT NULL,
    "job" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "lastStartedAt" TIMESTAMP(3),
    "lastFinishedAt" TIMESTAMP(3),
    "lastSucceededAt" TIMESTAMP(3),
    "lastError" TEXT,
    "details" JSONB,
    "lastAlertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJobStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncJobStatus_job_key" ON "SyncJobStatus"("job");

-- CreateIndex
CREATE INDEX "SyncJobStatus_status_idx" ON "SyncJobStatus"("status");
