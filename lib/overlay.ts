/**
 * The rendered (not baked) overlay label for a card's back, or null.
 * Only faces flagged `labelOverlay` (e.g. panorama member slices) get one; the
 * text is the card's back-text override else its position label, read live so
 * reordering relabels with no image regeneration.
 */
export function overlayLabelFor(
  card: {
    isItem?: boolean | null;
    number?: number | null;
    backText?: string | null;
    positionLabel?: string | null;
  },
  backFace: { labelOverlay?: boolean | null } | null | undefined,
): string | null {
  // Item cards draw their number over the (shared) set default back, so the
  // overlay is card-driven — not gated on the back face's labelOverlay flag.
  if (card.isItem) return card.number != null ? String(card.number) : null;
  if (!backFace?.labelOverlay) return null;
  // Same fallback as buildBackText (lib/locations): override, else position label.
  return card.backText?.trim() || card.positionLabel || null;
}
