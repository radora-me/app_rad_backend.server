ALTER TABLE "User" ADD COLUMN "address" TEXT;

UPDATE "User"
SET "address" = "className",
    "className" = NULL
WHERE "role" = 'teacher'::"Role"
  AND "className" IS NOT NULL
  AND "className" <> '';
