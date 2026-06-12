"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const textLayoutSchema = z.enum(["NONE", "TITLE_BANNER", "TEXT_BOX"]);

const cardCreateSchema = z.object({
  name: z.string().min(1),
  number: z.coerce.number().int().optional(),
  title: z.string().optional(),
  bodyText: z.string().optional(),
  imagePrompt: z.string().optional(),
  textLayout: textLayoutSchema.default("TITLE_BANNER"),
});

export async function createCard(setId: string, input: z.input<typeof cardCreateSchema>) {
  const data = cardCreateSchema.parse(input);
  const maxOrder = await prisma.card.aggregate({
    where: { setId },
    _max: { orderIndex: true },
  });
  const card = await prisma.card.create({
    data: {
      set: { connect: { id: setId } },
      name: data.name,
      number: data.number ?? null,
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
      front: {
        create: {
          textLayout: data.textLayout,
          title: data.title || data.name,
          bodyText: data.bodyText || null,
          imagePrompt: data.imagePrompt || null,
        },
      },
    },
  });
  revalidatePath(`/sets/${setId}`);
  return card.id;
}

export async function createCardAndOpen(setId: string, formData: FormData) {
  const cardId = await createCard(setId, {
    name: String(formData.get("name") ?? "New card"),
  });
  redirect(`/sets/${setId}/cards/${cardId}`);
}

const faceUpdateSchema = z.object({
  textLayout: textLayoutSchema,
  title: z.string().optional(),
  bodyText: z.string().optional(),
  imagePrompt: z.string().optional(),
});

export async function updateCardMeta(cardId: string, formData: FormData) {
  const numberRaw = formData.get("number");
  const card = await prisma.card.update({
    where: { id: cardId },
    data: {
      name: String(formData.get("name") ?? ""),
      // field is hidden when the set has numbering disabled — leave the value untouched then
      number: numberRaw === null ? undefined : numberRaw === "" ? null : Number(numberRaw),
      copies: Math.max(1, Number(formData.get("copies") ?? 1)),
    },
  });
  revalidatePath(`/sets/${card.setId}/cards/${cardId}`);
  revalidatePath(`/sets/${card.setId}`);
}

export async function updateFace(faceId: string, input: z.input<typeof faceUpdateSchema>) {
  const data = faceUpdateSchema.parse(input);
  await prisma.cardFace.update({
    where: { id: faceId },
    data: {
      textLayout: data.textLayout,
      title: data.title || null,
      bodyText: data.bodyText || null,
      imagePrompt: data.imagePrompt || null,
    },
  });
}

export async function deleteCard(cardId: string) {
  const card = await prisma.card.delete({ where: { id: cardId } });
  // Orphaned front face (and custom back) cleanup
  await prisma.cardFace.deleteMany({
    where: {
      id: { in: [card.frontFaceId, card.backFaceId ?? ""] },
      sharedBackSetId: null,
      backOfCards: { none: {} },
      frontOfCard: null,
    },
  });
  revalidatePath(`/sets/${card.setId}`);
  redirect(`/sets/${card.setId}`);
}

export async function setActiveImage(faceId: string, imageId: string) {
  await prisma.cardFace.update({
    where: { id: faceId },
    data: { activeImageId: imageId },
  });
}
