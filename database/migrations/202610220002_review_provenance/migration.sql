-- Nullable by design: historical records have no authenticated review attribution.
ALTER TABLE "Curriculum" ADD COLUMN "reviewedBy" TEXT, ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Instructor" ADD COLUMN "reviewedBy" TEXT, ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Offering" ADD COLUMN "reviewedBy" TEXT, ADD COLUMN "reviewedAt" TIMESTAMP(3);
