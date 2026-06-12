import type { CardFace, CardSet } from "@/lib/generated/prisma/client";

export function buildImagePrompt(
  face: Pick<CardFace, "textLayout" | "title" | "bodyText" | "imagePrompt">,
  set: Pick<CardSet, "stylePrompt" | "widthMm" | "heightMm">,
  cardNumber?: number | null,
) {
  const parts: string[] = [];

  if (set.stylePrompt.trim()) parts.push(set.stylePrompt.trim());
  if (face.imagePrompt?.trim()) parts.push(face.imagePrompt.trim());

  switch (face.textLayout) {
    case "NONE":
      parts.push("No text on the image.");
      break;
    case "TITLE_BANNER":
      if (face.title?.trim()) {
        parts.push(`A title banner near the bottom of the card reads exactly: "${face.title.trim()}"`);
      }
      break;
    case "TEXT_BOX": {
      const lines = ["The lower portion of the card is a text panel matching the art style."];
      if (face.title?.trim()) lines.push(`Its heading reads exactly: "${face.title.trim()}".`);
      if (face.bodyText?.trim()) lines.push(`Its body text reads exactly: "${face.bodyText.trim()}".`);
      parts.push(lines.join(" "));
      break;
    }
  }

  if (cardNumber != null) {
    parts.push(`A small badge in the top-right corner shows the number ${cardNumber}.`);
  }

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
