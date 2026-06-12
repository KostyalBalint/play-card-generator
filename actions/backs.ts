"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createSharedBack(setId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "Card back");
  await prisma.cardFace.create({
    data: {
      sharedBackSetId: setId,
      textLayout: "TITLE_BANNER",
      title,
    },
  });
  revalidatePath(`/sets/${setId}`);
}

export async function setDefaultBack(setId: string, faceId: string | null) {
  if (faceId) {
    const face = await prisma.cardFace.findUniqueOrThrow({ where: { id: faceId } });
    if (face.sharedBackSetId !== setId) throw new Error("Back does not belong to this set");
  }
  await prisma.cardSet.update({
    where: { id: setId },
    data: { defaultBackId: faceId },
  });
  revalidatePath(`/sets/${setId}`);
}

export async function deleteSharedBack(setId: string, faceId: string) {
  await prisma.$transaction([
    prisma.card.updateMany({ where: { backFaceId: faceId }, data: { backFaceId: null } }),
    prisma.cardSet.updateMany({ where: { id: setId, defaultBackId: faceId }, data: { defaultBackId: null } }),
    prisma.cardFace.delete({ where: { id: faceId } }),
  ]);
  revalidatePath(`/sets/${setId}`);
}

/** Point a card's back at a shared back, or null to fall back to the set default. */
export async function switchCardBack(cardId: string, faceId: string | null) {
  const card = await prisma.card.findUniqueOrThrow({ where: { id: cardId } });
  const oldBackId = card.backFaceId;
  await prisma.card.update({ where: { id: cardId }, data: { backFaceId: faceId } });
  // Clean up an orphaned custom back left behind
  if (oldBackId && oldBackId !== faceId) {
    await prisma.cardFace.deleteMany({
      where: { id: oldBackId, sharedBackSetId: null, backOfCards: { none: {} }, frontOfCard: null },
    });
  }
  revalidatePath(`/sets/${card.setId}/cards/${cardId}`);
}

/**
 * Slight-variant flow: copy a face's prompt/text fields into a new
 * card-specific custom back the user can tweak and regenerate.
 */
export async function duplicateAsCustomBack(cardId: string, sourceFaceId: string) {
  const source = await prisma.cardFace.findUniqueOrThrow({ where: { id: sourceFaceId } });
  const card = await prisma.card.findUniqueOrThrow({ where: { id: cardId } });
  const custom = await prisma.cardFace.create({
    data: {
      textLayout: source.textLayout,
      title: source.title,
      bodyText: source.bodyText,
      imagePrompt: source.imagePrompt,
    },
  });
  await prisma.card.update({ where: { id: cardId }, data: { backFaceId: custom.id } });
  revalidatePath(`/sets/${card.setId}/cards/${cardId}`);
  return custom.id;
}

/** Create a blank custom back for a card. */
export async function createCustomBack(cardId: string) {
  const card = await prisma.card.findUniqueOrThrow({ where: { id: cardId } });
  const custom = await prisma.cardFace.create({ data: { textLayout: "NONE" } });
  await prisma.card.update({ where: { id: cardId }, data: { backFaceId: custom.id } });
  revalidatePath(`/sets/${card.setId}/cards/${cardId}`);
  return custom.id;
}
