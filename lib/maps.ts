/**
 * Map cards: one master illustration sliced into a MAP_COLS x MAP_ROWS grid of
 * card fronts that tile back together on the table. The grid is square, so a
 * tile has the same aspect as the whole master — and as a single card, which is
 * why the master can be generated at the plain card size (see actions/maps).
 */
export const MAP_COLS = 2;
export const MAP_ROWS = 2;
export const MAP_TILES = MAP_COLS * MAP_ROWS;

export type TileRect = { left: number; top: number; width: number; height: number };
export type SizeMm = { widthMm: number; heightMm: number };

/**
 * Physical size of the whole assembled map. A landscape map is the same grid
 * given a quarter turn on the table: the cards stay portrait, the map reads wide.
 */
export function mapSizeMm(card: SizeMm, landscape: boolean): SizeMm {
  const w = MAP_COLS * card.widthMm;
  const h = MAP_ROWS * card.heightMm;
  return landscape ? { widthMm: h, heightMm: w } : { widthMm: w, heightMm: h };
}

/**
 * Size of a single tile *in the master's own frame*. For a landscape map the
 * master is drawn turned 90°, so each tile is a card lying on its side — which
 * is exactly what the tiling prompt has to describe.
 */
export function masterTileMm(card: SizeMm, landscape: boolean): SizeMm {
  return landscape ? { widthMm: card.heightMm, heightMm: card.widthMm } : card;
}

/**
 * Row-major tile rects of a W x H master (A B / C D). The last column and row
 * absorb the integer rounding, so the tiles always cover the source exactly with
 * no overlap and no dropped pixel column.
 */
export function mapTileRects(W: number, H: number): TileRect[] {
  const tileW = Math.floor(W / MAP_COLS);
  const tileH = Math.floor(H / MAP_ROWS);
  const rects: TileRect[] = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const left = col * tileW;
      const top = row * tileH;
      rects.push({
        left,
        top,
        width: col === MAP_COLS - 1 ? W - left : tileW,
        height: row === MAP_ROWS - 1 ? H - top : tileH,
      });
    }
  }
  return rects;
}
