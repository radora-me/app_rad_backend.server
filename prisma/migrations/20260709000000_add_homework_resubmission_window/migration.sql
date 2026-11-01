-- Track the latest teacher-authorized resubmission window.
ALTER TABLE "Homework"
ADD COLUMN "resubmissionOpenedAt" TIMESTAMP(3);
