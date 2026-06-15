import { PDFDocument, PDFImage, PDFPage, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { readStorageFile } from "@/lib/storage";
import { coverCrop } from "@/lib/imagecrop";
import { sizeForSet } from "@/lib/sizes";
import { resolveBackFaceId } from "@/lib/faces";
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
      cards: { orderBy: { orderIndex: "asc" }, include: { location: true } },
    },
  });

  const { widthMm, heightMm } = sizeForSet(set);
  const grid = computeGrid(widthMm, heightMm);

  // Group located cards together (by location order, then card order); loose cards after.
  const ordered = [...set.cards].sort((a, b) => {
    if (a.location && b.location) {
      if (a.location.orderIndex !== b.location.orderIndex) return a.location.orderIndex - b.location.orderIndex;
      return a.orderIndex - b.orderIndex;
    }
    if (a.location) return -1;
    if (b.location) return 1;
    return a.orderIndex - b.orderIndex;
  });

  // Expand copies into a flat list of {frontFaceId, backFaceId|null}
  const slots: { frontFaceId: string; backFaceId: string | null; name: string }[] = [];
  for (const card of ordered) {
    const backFaceId = resolveBackFaceId(card, set);
    for (let c = 0; c < card.copies; c++) {
      slots.push({ frontFaceId: card.frontFaceId, backFaceId, name: card.name });
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
  const faces = await prisma.cardFace.findMany({
    where: { id: { in: [...faceIds] } },
    include: { images: true },
  });
  for (const face of faces) {
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
      drawFace(backPage, sprite, grid.backSlots[idx], grid, font, slot.name);
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
) {
  const x = mmToPt(slot.xMm);
  // pdf-lib origin is bottom-left; slot coords are top-left mm
  const y = mmToPt(A4.heightMm - slot.yMm - grid.cardHeightMm);
  const w = mmToPt(grid.cardWidthMm);
  const h = mmToPt(grid.cardHeightMm);

  if (sprite.kind === "image") {
    page.drawImage(sprite.image, { x, y, width: w, height: h });
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
