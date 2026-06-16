-- Panorama member backs that were split before the labelOverlay feature existed
-- never got the overlay flag set, so the position label shows in neither preview
-- nor PDF. Enable the rendered overlay for every panorama member's back face.
UPDATE "CardFace"
SET "labelOverlay" = true
WHERE "id" IN (
  SELECT "backFaceId" FROM "Card"
  WHERE "inPanorama" = true AND "backFaceId" IS NOT NULL
);
