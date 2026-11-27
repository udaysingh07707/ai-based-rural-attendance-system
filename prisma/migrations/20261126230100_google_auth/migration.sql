ALTER TABLE "Teacher" ADD COLUMN "googleId" TEXT;

CREATE UNIQUE INDEX "Teacher_googleId_key" ON "Teacher"("googleId");
