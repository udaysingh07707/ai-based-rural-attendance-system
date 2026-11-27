CREATE TABLE "StudentPhoto" (
    "studentId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "imageBytes" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPhoto_pkey" PRIMARY KEY ("studentId")
);

ALTER TABLE "StudentPhoto"
ADD CONSTRAINT "StudentPhoto_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
