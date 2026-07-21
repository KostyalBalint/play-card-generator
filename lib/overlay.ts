/**
 * A rendered (not baked) overlay drawn over a card's back: a big centred label
 * and/or a small bottom-centred caption. Either half may be absent.
 */
export type FaceOverlay = { label: string | null; caption: string | null };

type OverlayCard = {
  isItem?: boolean | null;
  number?: number | null;
  backText?: string | null;
  positionLabel?: string | null;
  /** Card-driven overlay — works with any back, including the set's shared default. */
  labelOverlay?: boolean | null;
  /** Caption override; empty falls back to the location name. */
  overlayCaption?: string | null;
};

/**
 * The rendered (not baked) overlay for a card's back, or null.
 * Three sources, in order: item cards (number centred over the shared default
 * back), the card's own `labelOverlay` (centred letter + caption — e.g. a
 * location's card A, which usually sits outside the panorama), and back faces
 * flagged `labelOverlay` (panorama member slices, whose letter goes in the small
 * bottom caption so it stays out of the artwork). Text is read live, so
 * reordering cards or renaming a location relabels with no image regeneration.
 */
export function overlayFor(
  card: OverlayCard,
  backFace: { labelOverlay?: boolean | null } | null | undefined,
  locationName?: string | null,
): FaceOverlay | null {
  // Item cards draw their number over the (shared) set default back, so the
  // overlay is card-driven — not gated on the back face's labelOverlay flag.
  if (card.isItem) return card.number != null ? { label: String(card.number), caption: null } : null;
  // Same fallback as buildBackText (lib/locations): override, else position label.
  const label = card.backText?.trim() || card.positionLabel || null;
  if (!label) return null;
  if (card.labelOverlay) {
    return { label, caption: card.overlayCaption?.trim() || locationName?.trim() || null };
  }
  // Panorama slices: the letter is drawn small at the bottom, same plate style as
  // the caption on card A — the artwork spans the cards, so keep the centre clear.
  return backFace?.labelOverlay ? { label: null, caption: label } : null;
}
