export const A4 = { widthMm: 210, heightMm: 297 };
export const MIN_MARGIN_MM = 5;
export const GUTTER_MM = 4;

/** Cut marks: tick length and the gap between the card edge and the tick. */
export const CUT_MARK_LEN_MM = 4;
export const CUT_MARK_GAP_MM = 0.5;
/** How far outside the card a cut mark reaches. */
export const CUT_MARK_REACH_MM = CUT_MARK_GAP_MM + CUT_MARK_LEN_MM;

export type Slot = { xMm: number; yMm: number };

export type Grid = {
  cols: number;
  rows: number;
  perPage: number;
  cardWidthMm: number;
  cardHeightMm: number;
  /** Front-page slots, top-left mm coordinates, row-major */
  frontSlots: Slot[];
  /** Back-page slots: same order as frontSlots, x mirrored for duplex flip on long edge */
  backSlots: Slot[];
};

/**
 * How much the cards can grow, keeping their aspect and the same cols x rows.
 * The outer cards stop CUT_MARK_REACH_MM short of the MIN_MARGIN_MM edge so
 * their cut marks still land inside the printable area — marks pushed into a
 * printer's unprintable border would be clipped, and they are the whole point
 * of the margin. Always >= 1: a layout that fit at the nominal size still fits.
 */
export function fitScale(cardWidthMm: number, cardHeightMm: number, cols: number, rows: number) {
  const margin = MIN_MARGIN_MM + CUT_MARK_REACH_MM;
  const freeW = A4.widthMm - 2 * margin - (cols - 1) * GUTTER_MM;
  const freeH = A4.heightMm - 2 * margin - (rows - 1) * GUTTER_MM;
  return Math.max(1, Math.min(freeW / (cols * cardWidthMm), freeH / (rows * cardHeightMm)));
}

/**
 * The sheet layout for a card size. `fitToPage` keeps the card count the nominal
 * size yields and blows the cards up to fill the sheet instead of leaving the
 * slack as margin — a 70x105 card prints at 94.3x141.5 mm, same 4 per sheet.
 * Aspect is preserved, so the art is cropped exactly as before.
 */
export function computeGrid(cardWidthMm: number, cardHeightMm: number, fitToPage = false): Grid {
  const usableW = A4.widthMm - 2 * MIN_MARGIN_MM + GUTTER_MM;
  const usableH = A4.heightMm - 2 * MIN_MARGIN_MM + GUTTER_MM;
  const cols = Math.max(1, Math.floor(usableW / (cardWidthMm + GUTTER_MM)));
  const rows = Math.max(1, Math.floor(usableH / (cardHeightMm + GUTTER_MM)));

  if (fitToPage) {
    const scale = fitScale(cardWidthMm, cardHeightMm, cols, rows);
    cardWidthMm *= scale;
    cardHeightMm *= scale;
  }

  const gridW = cols * cardWidthMm + (cols - 1) * GUTTER_MM;
  const gridH = rows * cardHeightMm + (rows - 1) * GUTTER_MM;
  const originX = (A4.widthMm - gridW) / 2;
  const originY = (A4.heightMm - gridH) / 2;

  const frontSlots: Slot[] = [];
  const backSlots: Slot[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const xMm = originX + i * (cardWidthMm + GUTTER_MM);
      const yMm = originY + j * (cardHeightMm + GUTTER_MM);
      frontSlots.push({ xMm, yMm });
      // Duplex flip on long edge mirrors about the vertical axis:
      // a card's back must sit mirrored horizontally, same vertical position.
      backSlots.push({ xMm: A4.widthMm - xMm - cardWidthMm, yMm });
    }
  }

  return { cols, rows, perPage: cols * rows, cardWidthMm, cardHeightMm, frontSlots, backSlots };
}

export const mmToPt = (mm: number) => (mm * 72) / 25.4;
