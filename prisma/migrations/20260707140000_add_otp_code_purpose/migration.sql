-- CreateEnum
CREATE TYPE "OtpCodePurpose" AS ENUM ('email_verification', 'login');

-- AlterTable
ALTER TABLE "EmailVerificationCode" ADD COLUMN "purpose" "OtpCodePurpose" NOT NULL DEFAULT 'email_verification';

-- CreateIndex
CREATE INDEX "EmailVerificationCode_userId_purpose_idx" ON "EmailVerificationCode"("userId", "purpose");
