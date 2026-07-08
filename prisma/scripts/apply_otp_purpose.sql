-- Pending migration: 20260707140000_add_otp_code_purpose
CREATE TYPE "OtpCodePurpose" AS ENUM ('email_verification', 'login');

ALTER TABLE "EmailVerificationCode"
ADD COLUMN "purpose" "OtpCodePurpose" NOT NULL DEFAULT 'email_verification';

CREATE INDEX "EmailVerificationCode_userId_purpose_idx"
ON "EmailVerificationCode"("userId", "purpose");

INSERT INTO _prisma_migrations (
  id,
  checksum,
  finished_at,
  migration_name,
  logs,
  rolled_back_at,
  started_at,
  applied_steps_count
) VALUES (
  gen_random_uuid()::text,
  '14a8a983af8165fba8d5632765c6a817841bb543e383b05c5abf41ee2fcb4d68',
  NOW(),
  '20260707140000_add_otp_code_purpose',
  NULL,
  NULL,
  NOW(),
  1
);
