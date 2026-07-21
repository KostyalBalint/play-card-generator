import { PDFDocument, PDFImage, PDFPage, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { readStorageFile } from "@/lib/storage";
import { coverCrop } from "@/lib/imagecrop";
import { sizeForSet } from "@/lib/sizes";
import { resolveBackFaceId } from "@/lib/faces";
import { buildBackText } from "@/lib/locations";
import { overlayFor, type FaceOverlay } from "@/lib/overlay";
import { A4, computeGrid, Grid, mmToPt, Slot } from "./grid";

type FaceSprite =
  | { kind: "image"; image: PDFImage }
  | { kind: "placeholder"; label: string };

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
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  // Embed each distinct face image once
  const faceIds = new Set<string>();
  for (const s of slots) {
    faceIds.add(s.frontFaceId);
    if (s.backFaceId) faceIds.add(s.backFaceId);
  }
  const sprites = new Map<string, FaceSprite>();
  // Faces whose label is drawn as a rendered overlay (panorama members), not baked.
  const overlayFaces = new Set<string>();
  const faces = await prisma.cardFace.findMany({
    where: { id: { in: [...faceIds] } },
    include: { images: true },
  });
  for (const face of faces) {
    if (face.labelOverlay) overlayFaces.add(face.id);
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

  const pageW = mmToPt(A4.widthMm);
  const pageH = mmToPt(A4.heightMm);

  for (let start = 0; start < slots.length; start += grid.perPage) {
    const chunk = slots.slice(start, start + grid.perPage);

    const frontPage = pdf.addPage([pageW, pageH]);
    chunk.forEach((slot, idx) => {
      drawFace(frontPage, sprites.get(slot.frontFaceId)!, grid.frontSlots[idx], grid, font, slot.name);
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
      drawFace(backPage, sprite, grid.backSlots[idx], grid, font, slot.name, overlay);
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
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  name: string,
  overlay: FaceOverlay | null = null,
) {
  const x = mmToPt(slot.xMm);
  // pdf-lib origin is bottom-left; slot coords are top-left mm
  const y = mmToPt(A4.heightMm - slot.yMm - grid.cardHeightMm);
  const w = mmToPt(grid.cardWidthMm);
  const h = mmToPt(grid.cardHeightMm);

  if (sprite.kind === "image") {
    page.drawImage(sprite.image, { x, y, width: w, height: h });
    if (overlay) drawOverlay(page, overlay, x, y, w, h, font);
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
 * Rendered label (+ optional caption) drawn over a back image: the label dead
 * centre, the caption bottom-centred one inset up. Geometry is mirrored by
 * FaceOverlayLabel in components/CardFacePreview so the preview matches print.
 */
function drawOverlay(
  page: PDFPage,
  overlay: FaceOverlay,
  x: number,
  y: number,
  w: number,
  h: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
) {
  const size = h * 0.1;
  const inset = w * 0.05;
  const centerX = x + w / 2;
  if (overlay.label) {
    plate(page, overlay.label, size, centerX, y + h / 2 - plateHeight(size) / 2, font);
  }
  if (overlay.caption) {
    plate(page, overlay.caption, size * 0.45, centerX, y + inset, font);
  }
}

/** Plate height for a given font size — padY is 0.25em top and bottom. */
function plateHeight(size: number): number {
  return size * 1.5;
}

/** One dark text plate, horizontally centred on `centerX`, bottom edge at `bottom`. */
function plate(
  page: PDFPage,
  text: string,
  size: number,
  centerX: number,
  bottom: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
) {
  const padX = size * 0.4;
  const padY = size * 0.25;
  const textW = font.widthOfTextAtSize(text, size);
  const plateW = textW + 2 * padX;
  const plateH = plateHeight(size);
  const left = centerX - plateW / 2;
  // pdf-lib's drawRectangle has no border radius → draw the plate as a path.
  page.drawSvgPath(roundedRectPath(plateW, plateH, size * 0.3), {
    x: left,
    // drawSvgPath places the path's origin here and grows downward (SVG y-axis).
    y: bottom + plateH,
    color: rgb(0, 0, 0),
    opacity: 0.55,
    borderWidth: 0,
  });
  page.drawText(text, { x: left + padX, y: bottom + padY, size, font, color: rgb(1, 1, 1) });
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
