ALTER TABLE "SchoolClass" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Student" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "LoginRateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "LoginRateLimit_pkey" PRIMARY KEY ("key", "windowStart")
);

CREATE INDEX "LoginRateLimit_windowStart_idx" ON "LoginRateLimit"("windowStart");
