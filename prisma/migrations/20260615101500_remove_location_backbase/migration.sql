-- Per-location generic back design removed in favour of the set's pack-level
-- shared backs. Drop the Location.backBaseId link. Former back-base faces are
-- left in place (still referenced as bases of label variants via basedOnFaceId).
ALTER TABLE "Location" DROP CONSTRAINT IF EXISTS "Location_backBaseId_fkey";
DROP INDEX IF EXISTS "Location_backBaseId_key";
ALTER TABLE "Location" DROP COLUMN IF EXISTS "backBaseId";
