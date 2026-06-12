export const A4 = { widthMm: 210, heightMm: 297 };
export const MIN_MARGIN_MM = 5;
export const GUTTER_MM = 4;

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

export function computeGrid(cardWidthMm: number, cardHeightMm: number): Grid {
  const usableW = A4.widthMm - 2 * MIN_MARGIN_MM + GUTTER_MM;
  const usableH = A4.heightMm - 2 * MIN_MARGIN_MM + GUTTER_MM;
  const cols = Math.max(1, Math.floor(usableW / (cardWidthMm + GUTTER_MM)));
  const rows = Math.max(1, Math.floor(usableH / (cardHeightMm + GUTTER_MM)));

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
