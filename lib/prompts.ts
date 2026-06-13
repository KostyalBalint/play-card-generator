import type { CardFace, CardSet } from "@/lib/generated/prisma/client";

export function buildImagePrompt(
  face: Pick<CardFace, "textLayout" | "title" | "bodyText" | "imagePrompt">,
  set: Pick<CardSet, "stylePrompt" | "widthMm" | "heightMm">,
  cardNumber?: number | null,
) {
  const parts: string[] = [];

  if (set.stylePrompt.trim()) parts.push(set.stylePrompt.trim());
  if (face.imagePrompt?.trim()) parts.push(face.imagePrompt.trim());

  const clause = textLayoutClause(face);
  if (clause) parts.push(clause);

  if (cardNumber != null) {
    parts.push(`A small badge in the top-right corner shows the number ${cardNumber}.`);
  }

  parts.push(buildPhysicalSizeParagraph(set));

  return parts.join("\n\n");
}

/** The title/body-text instruction for a face's layout (empty when nothing to say). */
export function textLayoutClause(
  face: Pick<CardFace, "textLayout" | "title" | "bodyText">,
): string {
  switch (face.textLayout) {
    case "NONE":
      return "No text on the image.";
    case "TITLE_BANNER":
      return face.title?.trim()
        ? `A title banner near the bottom of the card reads exactly: "${face.title.trim()}"`
        : "";
    case "TEXT_BOX": {
      const lines = ["The lower portion of the card is a text panel matching the art style."];
      if (face.title?.trim()) lines.push(`Its heading reads exactly: "${face.title.trim()}".`);
      if (face.bodyText?.trim()) lines.push(`Its body text reads exactly: "${face.bodyText.trim()}".`);
      return lines.join(" ");
    }
    default:
      return "";
  }
}

/** Image-edit prompt that bakes only the face's title/body text onto an existing image. */
export function buildTextAlterPrompt(
  face: Pick<CardFace, "textLayout" | "title" | "bodyText" | "imagePrompt">,
  set: Pick<CardSet, "widthMm" | "heightMm">,
) {
  const parts: string[] = [];
  if (face.imagePrompt?.trim()) {
    parts.push(`Scene context (already drawn, do not redraw): ${face.imagePrompt.trim()}`);
  }
  parts.push(
    face.textLayout === "NONE"
      ? "Remove any title or body-text overlay, leaving the artwork clean."
      : textLayoutClause(face) || "Keep the existing text as is.",
  );
  parts.push(
    "Only add, update or remove the title/body text described above. Keep all artwork, characters, " +
      "colours, style and composition exactly as in the input image.",
  );
  parts.push(buildPhysicalSizeParagraph(set));
  return parts.join("\n\n");
}

export function buildPhysicalSizeParagraph(set: Pick<CardSet, "widthMm" | "heightMm">) {
  const { widthMm: w, heightMm: h } = set;
  const orientation = w <= h ? "portrait" : "landscape";
  const divisor = gcd(Math.round(w * 10), Math.round(h * 10));
  const aspect = `${Math.round(w * 10) / divisor}:${Math.round(h * 10) / divisor}`;
  return (
    `The composition is a full-bleed face of a physical playing card that will be printed at ${w} × ${h} mm ` +
    `(${orientation} orientation, aspect ratio ${aspect}). Compose the image for exactly these proportions ` +
    `with no letterboxing or borders. Because the printed card is small, keep details bold and uncluttered, ` +
    `and make all text large enough to stay clearly legible at that print size, correctly spelled, ` +
    `and kept inside a safe margin of about 3mm from the card edges.`
  );
}

/**
 * Front face generated using its own full prompt, but with a reference image
 * (typically the card's back) supplied so the art stays visually consistent.
 */
export function buildPromptWithReference(
  face: Pick<CardFace, "textLayout" | "title" | "bodyText" | "imagePrompt">,
  set: Pick<CardSet, "stylePrompt" | "widthMm" | "heightMm">,
  cardNumber?: number | null,
) {
  return [
    buildImagePrompt(face, set, cardNumber),
    "A reference image is provided. Match its art style, colour palette, character design and setting, " +
      "and depict the same character(s) and place — this is a different side/scene of the same card, " +
      "following the description above. Do not copy the reference's text or layout.",
  ].join("\n\n");
}

export function buildEditPrompt(alterPrompt: string, set: Pick<CardSet, "widthMm" | "heightMm">) {
  return [
    alterPrompt.trim(),
    "Keep the same visual style, composition and design as the input image.",
    buildPhysicalSizeParagraph(set),
  ].join("\n\n");
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
