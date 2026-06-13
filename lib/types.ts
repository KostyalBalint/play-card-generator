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

export type { Card, CardFace, CardSet, GeneratedImage };
export type { Location } from "@/lib/generated/prisma/client";
