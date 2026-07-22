"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * Item cards are loose cards grouped in the set's flat Items section. They reuse
 * the generic card editor for their front; their back is one shared back picked
 * for the whole section (CardSet.itemBackId, else the set default) with the item
 * number drawn as a rendered overlay (lib/overlay).
 */
export async function createItem(setId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim() || "New item";
  const count = await prisma.card.count({ where: { setId, isItem: true } });
  const maxOrder = await prisma.card.aggregate({ where: { setId }, _max: { orderIndex: true } });

  // No back is created: items fall back to the set's default shared back, and
  // their number is overlaid live (no per-card back image, no regeneration).
  const card = await prisma.card.create({
    data: {
      set: { connect: { id: setId } },
      isItem: true,
      number: count + 1,
      name,
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
      front: { create: { textLayout: "TITLE_BANNER", title: name } },
    },
  });
  redirect(`/sets/${setId}/cards/${card.id}`);
}

/**
 * Choose which shared back all item cards use; null falls back to the set's
 * default back. Variants count as backs, so items can take a "pack" member.
 */
export async function setItemBack(setId: string, faceId: string | null) {
  if (faceId) {
    const face = await prisma.cardFace.findUniqueOrThrow({ where: { id: faceId } });
    if (face.sharedBackSetId !== setId) throw new Error("Back does not belong to this set");
  }
  await prisma.cardSet.update({ where: { id: setId }, data: { itemBackId: faceId } });
  revalidatePath(`/sets/${setId}`);
}

/** Renumber items 1..N by the given order (numbers are overlaid live — no image work). */
export async function reorderItems(setId: string, orderedCardIds: string[]) {
  await prisma.$transaction(
    orderedCardIds.map((cardId, i) =>
      prisma.card.update({ where: { id: cardId }, data: { number: i + 1, orderIndex: i } }),
    ),
  );
  revalidatePath(`/sets/${setId}`);
}
