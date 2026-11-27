ALTER TABLE "Teacher" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "lastName" TEXT;
ALTER TABLE "Teacher" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TYPE "OtpPurpose" AS ENUM ('SIGNUP', 'LOGIN');

CREATE TABLE "EmailOtp" (
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailOtp_pkey" PRIMARY KEY ("email")
);

CREATE INDEX "EmailOtp_expiresAt_idx" ON "EmailOtp"("expiresAt");
