import { buildBackText } from "@/lib/locations";

/**
 * The rendered (not baked) overlay label for a card's back, or null.
 * Only faces flagged `labelOverlay` (e.g. panorama member slices) get one; the
 * text is the card's back-text override else its position label, read live so
 * reordering relabels with no image regeneration.
 */
export function overlayLabelFor(
  card: { backText?: string | null; positionLabel?: string | null },
  backFace: { labelOverlay?: boolean | null } | null | undefined,
): string | null {
  if (!backFace?.labelOverlay) return null;
  return buildBackText(card) || null;
}
