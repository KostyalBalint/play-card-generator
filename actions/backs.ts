"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseOverlayStyle, type OverlayStyle } from "@/lib/overlaystyle";

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
  // Deleting a base back takes its variants with it — otherwise SetNull would
  // promote them to confusingly-named top-level backs.
  const variants = await prisma.cardFace.findMany({
    where: { basedOnFaceId: faceId },
    select: { id: true },
  });
  const ids = [faceId, ...variants.map((v) => v.id)];
  await prisma.$transaction([
    prisma.card.updateMany({ where: { backFaceId: { in: ids } }, data: { backFaceId: null } }),
    prisma.cardSet.updateMany({ where: { id: setId, defaultBackId: { in: ids } }, data: { defaultBackId: null } }),
    prisma.cardSet.updateMany({ where: { id: setId, itemBackId: { in: ids } }, data: { itemBackId: null } }),
    prisma.cardFace.deleteMany({ where: { id: { in: ids } } }),
  ]);
  revalidatePath(`/sets/${setId}`);
}

/**
 * Set how the rendered overlay (item number, position letter, caption) is placed
 * and styled over this face. Lives on the face, so every card using a shared
 * back inherits the same arrangement. See lib/overlaystyle.
 */
export async function updateOverlayStyle(faceId: string, style: OverlayStyle) {
  const face = await prisma.cardFace.findUniqueOrThrow({
    where: { id: faceId },
    select: {
      sharedBackSetId: true,
      backOfCards: { select: { setId: true }, take: 1 },
      panoramaOfLocation: { select: { setId: true } },
      mapBackOf: { select: { setId: true } },
    },
  });
  await prisma.cardFace.update({
    where: { id: faceId },
    // Re-parsed server-side: unknown keys and out-of-range numbers are dropped.
    data: { overlayStyle: parseOverlayStyle(style) },
  });
  const setId =
    face.sharedBackSetId ??
    face.panoramaOfLocation?.setId ??
    face.mapBackOf?.setId ??
    face.backOfCards[0]?.setId;
  if (setId) revalidatePath(`/sets/${setId}`, "layout");
}

/** Create a label variant of a shared back ("pack" member: same design, different text). */
export async function createBackVariant(setId: string, baseFaceId: string, label: string) {
  const base = await prisma.cardFace.findUniqueOrThrow({ where: { id: baseFaceId } });
  if (base.sharedBackSetId !== setId) throw new Error("Base back does not belong to this set");
  await prisma.cardFace.create({
    data: {
      sharedBackSetId: setId,
      basedOnFaceId: baseFaceId,
      variantLabel: label,
      title: label,
      textLayout: base.textLayout,
      imagePrompt: base.imagePrompt,
      bodyText: base.bodyText,
    },
  });
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
