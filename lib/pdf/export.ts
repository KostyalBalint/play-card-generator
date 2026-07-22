import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFImage, PDFPage, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { prisma } from "@/lib/prisma";
import { readStorageFile } from "@/lib/storage";
import { coverCrop } from "@/lib/imagecrop";
import { sizeForSet } from "@/lib/sizes";
import { resolveBackFaceId } from "@/lib/faces";
import { buildBackText } from "@/lib/locations";
import { overlayFor, type FaceOverlay } from "@/lib/overlay";
import {
  DEFAULT_OVERLAY_STYLE,
  FONT_CATALOG,
  PLATE_PAD_X_EM,
  PLATE_PAD_Y_EM,
  PLATE_RADIUS_EM,
  hexToRgb,
  parseOverlayStyle,
  placement,
  plateFill,
  type OverlayStyle,
  type OverlayTextStyle,
} from "@/lib/overlaystyle";
import { A4, computeGrid, Grid, mmToPt, Slot } from "./grid";

type FaceSprite =
  | { kind: "image"; image: PDFImage }
  | { kind: "placeholder"; label: string };

type EmbeddedFont = Awaited<ReturnType<PDFDocument["embedFont"]>>;

/** The fonts this document needs, keyed `${family}:${weight}` — see FontBook. */
type FontBook = { get: (style: OverlayTextStyle) => EmbeddedFont; fallback: EmbeddedFont };

const STANDARD_FONTS: Record<string, { regular: StandardFonts; bold: StandardFonts }> = {
  sans: { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold },
  serif: { regular: StandardFonts.TimesRoman, bold: StandardFonts.TimesRomanBold },
  mono: { regular: StandardFonts.Courier, bold: StandardFonts.CourierBold },
};

const fontKey = (style: OverlayTextStyle) => `${style.font}:${style.bold ? "bold" : "regular"}`;

/**
 * Embed only the fonts the given styles actually use: PDF standard fonts by
 * name, bundled OFL families from public/fonts through fontkit (subsetted).
 * A missing or unreadable file degrades to Helvetica rather than failing the
 * export.
 */
async function buildFontBook(pdf: PDFDocument, styles: OverlayStyle[]): Promise<FontBook> {
  pdf.registerFontkit(fontkit);
  const fallback = await pdf.embedFont(StandardFonts.Helvetica);
  const book = new Map<string, EmbeddedFont>();
  const wanted = new Map<string, OverlayTextStyle>();
  for (const style of styles) {
    for (const slot of [style.label, style.caption]) wanted.set(fontKey(slot), slot);
  }
  for (const [key, slot] of wanted) {
    const entry = FONT_CATALOG[slot.font];
    try {
      if (!entry.files) {
        const std = STANDARD_FONTS[slot.font];
        book.set(key, await pdf.embedFont(slot.bold ? std.bold : std.regular));
        continue;
      }
      // Families with no bold cut reuse the regular file — same as the preview,
      // whose @font-face maps 400-700 onto it.
      const file = (slot.bold && entry.files.bold) || entry.files.regular;
      const bytes = await readFile(path.join(process.cwd(), "public", "fonts", file));
      book.set(key, await pdf.embedFont(bytes, { subset: entry.files.subset }));
    } catch {
      book.set(key, fallback);
    }
  }
  return { get: (style) => book.get(fontKey(style)) ?? fallback, fallback };
}

const CUT_MARK_LEN_MM = 4;
const CUT_MARK_GAP_MM = 0.5;

export async function exportSetPdf(setId: string): Promise<Uint8Array> {
  const set = await prisma.cardSet.findUniqueOrThrow({
    where: { id: setId },
    include: {
      cards: { orderBy: { orderIndex: "asc" }, include: { location: true, map: true } },
    },
  });

  const { widthMm, heightMm } = sizeForSet(set);
  const grid = computeGrid(widthMm, heightMm);

  // Group contiguously by tier: located cards (by location/card order), then maps
  // (by map order), then items (by number), then loose cards.
  const tier = (c: (typeof set.cards)[number]) => (c.location ? 0 : c.map ? 1 : c.isItem ? 2 : 3);
  const ordered = [...set.cards].sort((a, b) => {
    const ta = tier(a);
    const tb = tier(b);
    if (ta !== tb) return ta - tb;
    if (ta === 0 && a.location && b.location && a.location.orderIndex !== b.location.orderIndex) {
      return a.location.orderIndex - b.location.orderIndex;
    }
    if (ta === 1 && a.map && b.map && a.map.orderIndex !== b.map.orderIndex) {
      return a.map.orderIndex - b.map.orderIndex;
    }
    if (ta === 2) return (a.number ?? 0) - (b.number ?? 0) || a.orderIndex - b.orderIndex;
    return a.orderIndex - b.orderIndex;
  });

  // Expand copies into a flat list of {frontFaceId, backFaceId|null, backLabel}
  const slots: {
    frontFaceId: string;
    backFaceId: string | null;
    name: string;
    backLabel: string | null;
    /** Card-driven overlay (letter + caption), independent of the back face. */
    cardOverlay: FaceOverlay | null;
    isItem: boolean;
    number: number | null;
  }[] = [];
  for (const card of ordered) {
    const backFaceId = resolveBackFaceId(card, set);
    const backLabel = buildBackText(card) || null;
    // labelOverlay on the card itself → drawn over whatever back it uses.
    const cardOverlay = card.labelOverlay
      ? overlayFor(card, null, card.location?.name ?? null)
      : null;
    for (let c = 0; c < card.copies; c++) {
      slots.push({
        frontFaceId: card.frontFaceId,
        backFaceId,
        name: card.name,
        backLabel,
        cardOverlay,
        isItem: card.isItem,
        number: card.number,
      });
    }
  }

  const pdf = await PDFDocument.create();

  // Embed each distinct face image once
  const faceIds = new Set<string>();
  for (const s of slots) {
    faceIds.add(s.frontFaceId);
    if (s.backFaceId) faceIds.add(s.backFaceId);
  }
  const sprites = new Map<string, FaceSprite>();
  // Faces whose label is drawn as a rendered overlay (panorama members), not baked.
  const overlayFaces = new Set<string>();
  // Per-face overlay placement/look — a back design carries its own arrangement.
  const overlayStyles = new Map<string, OverlayStyle>();
  const faces = await prisma.cardFace.findMany({
    where: { id: { in: [...faceIds] } },
    include: { images: true },
  });
  for (const face of faces) {
    if (face.labelOverlay) overlayFaces.add(face.id);
    overlayStyles.set(face.id, parseOverlayStyle(face.overlayStyle));
    const active = face.images.find(
      (img) => img.id === face.activeImageId && img.status === "DONE" && img.filePath,
    );
    if (active?.filePath) {
      const bytes = await readStorageFile(active.filePath);
      // Masters are stored uncropped; cover-crop to the card aspect for print.
      const cropped = await coverCrop(bytes, widthMm / heightMm);
      sprites.set(face.id, { kind: "image", image: await pdf.embedPng(cropped) });
    } else {
      sprites.set(face.id, { kind: "placeholder", label: face.title ?? "no image" });
    }
  }

  const fonts = await buildFontBook(pdf, [...overlayStyles.values(), DEFAULT_OVERLAY_STYLE]);

  const pageW = mmToPt(A4.widthMm);
  const pageH = mmToPt(A4.heightMm);

  for (let start = 0; start < slots.length; start += grid.perPage) {
    const chunk = slots.slice(start, start + grid.perPage);

    const frontPage = pdf.addPage([pageW, pageH]);
    chunk.forEach((slot, idx) => {
      drawFace(frontPage, sprites.get(slot.frontFaceId)!, grid.frontSlots[idx], grid, fonts, slot.name);
    });
    drawCutMarks(frontPage, chunk.length, grid.frontSlots, grid);

    const backPage = pdf.addPage([pageW, pageH]);
    chunk.forEach((slot, idx) => {
      const sprite: FaceSprite = slot.backFaceId
        ? sprites.get(slot.backFaceId)!
        : { kind: "placeholder", label: "card back" };
      // Items draw their number centred over the (shared) default back; cards
      // flagged labelOverlay draw their letter + caption over any back; panorama
      // members draw their letter in the small bottom caption, and only when the
      // back face is flagged labelOverlay. Mirrors overlayFor in lib/overlay.
      const overlay: FaceOverlay | null = slot.isItem
        ? slot.number != null
          ? { label: String(slot.number), caption: null }
          : null
        : slot.cardOverlay ??
          (slot.backFaceId && overlayFaces.has(slot.backFaceId) && slot.backLabel
            ? { label: null, caption: slot.backLabel }
            : null);
      drawFace(
        backPage,
        sprite,
        grid.backSlots[idx],
        grid,
        fonts,
        slot.name,
        overlay,
        (slot.backFaceId && overlayStyles.get(slot.backFaceId)) || DEFAULT_OVERLAY_STYLE,
      );
    });
    drawCutMarks(backPage, chunk.length, grid.backSlots, grid);
  }

  return pdf.save();
}

function drawFace(
  page: PDFPage,
  sprite: FaceSprite,
  slot: Slot,
  grid: Grid,
  fonts: FontBook,
  name: string,
  overlay: FaceOverlay | null = null,
  overlayStyle: OverlayStyle = DEFAULT_OVERLAY_STYLE,
) {
  const x = mmToPt(slot.xMm);
  // pdf-lib origin is bottom-left; slot coords are top-left mm
  const y = mmToPt(A4.heightMm - slot.yMm - grid.cardHeightMm);
  const w = mmToPt(grid.cardWidthMm);
  const h = mmToPt(grid.cardHeightMm);

  if (sprite.kind === "image") {
    page.drawImage(sprite.image, { x, y, width: w, height: h });
    if (overlay) drawOverlay(page, overlay, x, y, w, h, fonts, overlayStyle);
  } else {
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      color: rgb(0.93, 0.93, 0.93),
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 0.5,
    });
    const label = `${name} (${sprite.label})`;
    const size = 9;
    const font = fonts.fallback;
    const textWidth = font.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: x + (w - textWidth) / 2,
      y: y + h / 2,
      size,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }
}

/**
 * Rendered label (+ optional caption) drawn over a back image, placed and styled
 * per the back face's own overlay style (lib/overlaystyle). Geometry is mirrored
 * by FaceOverlayLabel in components/CardFacePreview so preview matches print.
 */
function drawOverlay(
  page: PDFPage,
  overlay: FaceOverlay,
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: FontBook,
  style: OverlayStyle,
) {
  if (overlay.label) plate(page, overlay.label, style.label, x, y, w, h, fonts);
  if (overlay.caption) plate(page, overlay.caption, style.caption, x, y, w, h, fonts);
}

/** Plate height for a given font size — padY is PLATE_PAD_Y_EM top and bottom. */
function plateHeight(size: number): number {
  return size * (1 + 2 * PLATE_PAD_Y_EM);
}

/** One text plate placed by its style within the card box at (x, y, w, h). */
function plate(
  page: PDFPage,
  text: string,
  style: OverlayTextStyle,
  x: number,
  y: number,
  w: number,
  h: number,
  fonts: FontBook,
) {
  const font = fonts.get(style);
  const size = h * (style.sizePct / 100);
  const padX = size * PLATE_PAD_X_EM;
  const padY = size * PLATE_PAD_Y_EM;
  const plateW = font.widthOfTextAtSize(text, size) + 2 * padX;
  const plateH = plateHeight(size);

  const p = placement(style, w / h);
  // Placement fractions are top-left origin; pdf-lib's origin is bottom-left.
  const anchorX = x + p.xFrac * w;
  const anchorY = y + h - p.yFrac * h;
  const left = p.alignX === "start" ? anchorX : p.alignX === "end" ? anchorX - plateW : anchorX - plateW / 2;
  const bottom =
    p.alignY === "start" ? anchorY - plateH : p.alignY === "end" ? anchorY : anchorY - plateH / 2;

  const fill = plateFill(style);
  if (fill) {
    const c = hexToRgb(fill.color);
    // pdf-lib's drawRectangle has no border radius → draw the plate as a path.
    page.drawSvgPath(roundedRectPath(plateW, plateH, size * PLATE_RADIUS_EM), {
      x: left,
      // drawSvgPath places the path's origin here and grows downward (SVG y-axis).
      y: bottom + plateH,
      color: rgb(c.r, c.g, c.b),
      opacity: fill.opacity,
      borderWidth: 0,
    });
  }
  const t = hexToRgb(style.color);
  page.drawText(text, {
    x: left + padX,
    y: bottom + padY,
    size,
    font,
    color: rgb(t.r, t.g, t.b),
    opacity: style.textOpacity / 100,
  });
}

/** Rounded-rect SVG path, origin top-left. Quadratic corners — flip-safe. */
function roundedRectPath(w: number, h: number, r: number): string {
  const rad = Math.min(r, w / 2, h / 2);
  return [
    `M ${rad} 0`,
    `L ${w - rad} 0`,
    `Q ${w} 0 ${w} ${rad}`,
    `L ${w} ${h - rad}`,
    `Q ${w} ${h} ${w - rad} ${h}`,
    `L ${rad} ${h}`,
    `Q 0 ${h} 0 ${h - rad}`,
    `L 0 ${rad}`,
    `Q 0 0 ${rad} 0`,
    "Z",
  ].join(" ");
}

/** Tick marks extending outward from each card corner — never across card faces. */
function drawCutMarks(page: PDFPage, count: number, slots: Slot[], grid: Grid) {
  const len = CUT_MARK_LEN_MM;
  const gap = CUT_MARK_GAP_MM;
  for (let idx = 0; idx < count; idx++) {
    const { xMm, yMm } = slots[idx];
    const edgesX = [xMm, xMm + grid.cardWidthMm];
    const edgesY = [yMm, yMm + grid.cardHeightMm];
    for (const ex of edgesX) {
      for (const ey of edgesY) {
        // horizontal tick: outward left for left edge, right for right edge
        const hDir = ex === xMm ? -1 : 1;
        line(page, ex + hDir * gap, ey, ex + hDir * (gap + len), ey);
        // vertical tick: outward up for top edge, down for bottom edge
        const vDir = ey === yMm ? -1 : 1;
        line(page, ex, ey + vDir * gap, ex, ey + vDir * (gap + len));
      }
    }
  }
}

function line(page: PDFPage, x1Mm: number, y1Mm: number, x2Mm: number, y2Mm: number) {
  page.drawLine({
    start: { x: mmToPt(x1Mm), y: mmToPt(A4.heightMm - y1Mm) },
    end: { x: mmToPt(x2Mm), y: mmToPt(A4.heightMm - y2Mm) },
    thickness: 0.2,
    color: rgb(0, 0, 0),
  });
}
