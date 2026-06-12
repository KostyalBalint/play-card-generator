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

  parts.push(
    "The composition is a full-bleed playing card face in portrait orientation. " +
      "All text must be fully legible, correctly spelled, and kept inside a safe margin of about 3mm from the card edges.",
  );

  return parts.join("\n\n");
}
