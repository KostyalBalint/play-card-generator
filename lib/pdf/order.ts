/**
 * The order a set's cards are printed — and therefore numbered — in. Maps first
 * (each map's quadrants in place), then the flat Items section, then the located
 * cards location by location (A → N inside each), then anything loose.
 *
 * Sorting located cards by `orderIndex` *is* A → N: actions/locations keeps
 * `positionLabel` and `orderIndex` in lockstep on every reorder.
 */
export type OrderableCard = {
  location: { orderIndex: number } | null;
  map: { orderIndex: number } | null;
  isItem: boolean;
  number: number | null;
  orderIndex: number;
};

const TIER = { map: 0, item: 1, location: 2, loose: 3 };

/** A map member belongs to its map even if it also sits in a location. */
function tierOf(card: OrderableCard): number {
  if (card.map) return TIER.map;
  if (card.isItem) return TIER.item;
  if (card.location) return TIER.location;
  return TIER.loose;
}

export function orderCardsForExport<T extends OrderableCard>(cards: T[]): T[] {
  return [...cards].sort((a, b) => {
    const ta = tierOf(a);
    const tb = tierOf(b);
    if (ta !== tb) return ta - tb;
    if (ta === TIER.map && a.map && b.map && a.map.orderIndex !== b.map.orderIndex) {
      return a.map.orderIndex - b.map.orderIndex;
    }
    if (ta === TIER.item && (a.number ?? 0) !== (b.number ?? 0)) {
      return (a.number ?? 0) - (b.number ?? 0);
    }
    if (
      ta === TIER.location &&
      a.location &&
      b.location &&
      a.location.orderIndex !== b.location.orderIndex
    ) {
      return a.location.orderIndex - b.location.orderIndex;
    }
    return a.orderIndex - b.orderIndex;
  });
}
