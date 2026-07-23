import type { Card, CardFace, CardSet, GeneratedImage } from "@/lib/generated/prisma/client";

export type FaceWithImages = CardFace & { images: GeneratedImage[] };

export type FaceDraft = {
  textLayout: CardFace["textLayout"];
  title: string;
  bodyText: string;
  imagePrompt: string;
};

export function draftFromFace(face: CardFace): FaceDraft {
  return {
    textLayout: face.textLayout,
    title: face.title ?? "",
    bodyText: face.bodyText ?? "",
    imagePrompt: face.imagePrompt ?? "",
  };
}

/**
 * Art that can seed another face's generation: a card's front, or a picture the
 * user uploaded to the set (kind "upload", imageId = ReferenceImage id). Built
 * server-side by lib/references, rendered by the picker in components/FaceForm.
 */
export type ReferenceCard = {
  id: string;
  label: string;
  imageId: string;
  kind?: "card" | "upload";
};

export type { Card, CardFace, CardSet, GeneratedImage };
export type { Location, Map, ReferenceImage } from "@/lib/generated/prisma/client";
