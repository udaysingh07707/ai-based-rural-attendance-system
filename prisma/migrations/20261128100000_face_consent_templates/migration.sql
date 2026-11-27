CREATE TABLE "FaceConsent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activeStudentId" TEXT,
    "classId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "recordedByTeacherId" TEXT NOT NULL,
    "guardianName" TEXT NOT NULL,
    "guardianRelationship" TEXT NOT NULL,
    "consentReference" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "FaceConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentFaceTemplate" (
    "studentId" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "nonce" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "keyVersion" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "profilePhotoUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFaceTemplate_pkey" PRIMARY KEY ("studentId")
);

CREATE UNIQUE INDEX "StudentFaceTemplate_consentId_key" ON "StudentFaceTemplate"("consentId");
CREATE UNIQUE INDEX "FaceConsent_activeStudentId_key" ON "FaceConsent"("activeStudentId");
CREATE UNIQUE INDEX "FaceConsent_studentId_id_key" ON "FaceConsent"("studentId", "id");
CREATE UNIQUE INDEX "FaceConsent_id_studentId_key" ON "FaceConsent"("id", "studentId");
CREATE INDEX "FaceConsent_studentId_schoolId_grantedAt_idx" ON "FaceConsent"("studentId", "schoolId", "grantedAt");
CREATE INDEX "FaceConsent_schoolId_revokedAt_idx" ON "FaceConsent"("schoolId", "revokedAt");
CREATE UNIQUE INDEX "Student_id_classId_key" ON "Student"("id", "classId");
CREATE UNIQUE INDEX "SchoolClass_id_schoolId_key" ON "SchoolClass"("id", "schoolId");
CREATE UNIQUE INDEX "StudentFaceTemplate_consentId_studentId_key" ON "StudentFaceTemplate"("consentId", "studentId");

ALTER TABLE "FaceConsent" ADD CONSTRAINT "FaceConsent_studentId_fkey"
FOREIGN KEY ("studentId", "classId") REFERENCES "Student"("id", "classId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FaceConsent" ADD CONSTRAINT "FaceConsent_classId_schoolId_fkey"
FOREIGN KEY ("classId", "schoolId") REFERENCES "SchoolClass"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FaceConsent" ADD CONSTRAINT "FaceConsent_activeStudentId_id_fkey"
FOREIGN KEY ("activeStudentId", "id") REFERENCES "FaceConsent"("studentId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "FaceConsent" ADD CONSTRAINT "FaceConsent_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FaceConsent" ADD CONSTRAINT "FaceConsent_recordedByTeacherId_fkey"
FOREIGN KEY ("recordedByTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentFaceTemplate" ADD CONSTRAINT "StudentFaceTemplate_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentFaceTemplate" ADD CONSTRAINT "StudentFaceTemplate_consentId_fkey"
FOREIGN KEY ("consentId", "studentId") REFERENCES "FaceConsent"("id", "studentId") ON DELETE CASCADE ON UPDATE CASCADE;
