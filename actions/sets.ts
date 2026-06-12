"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SIZE_PRESETS } from "@/lib/sizes";

const setSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  stylePrompt: z.string().default(""),
  sizePreset: z.enum(["POKER", "TAROT", "CUSTOM"]).default("TAROT"),
  widthMm: z.coerce.number().positive().max(200).default(70),
  heightMm: z.coerce.number().positive().max(287).default(120),
});

function sizeFields(data: z.infer<typeof setSchema>) {
  if (data.sizePreset === "CUSTOM") return { widthMm: data.widthMm, heightMm: data.heightMm };
  return SIZE_PRESETS[data.sizePreset];
}

export async function createSet(formData: FormData) {
  const data = setSchema.parse(Object.fromEntries(formData));
  const set = await prisma.cardSet.create({
    data: {
      name: data.name,
      description: data.description || null,
      stylePrompt: data.stylePrompt,
      sizePreset: data.sizePreset,
      ...sizeFields(data),
    },
  });
  redirect(`/sets/${set.id}`);
}

export async function updateSet(setId: string, formData: FormData) {
  const data = setSchema.parse(Object.fromEntries(formData));
  await prisma.cardSet.update({
    where: { id: setId },
    data: {
      name: data.name,
      description: data.description || null,
      stylePrompt: data.stylePrompt,
      sizePreset: data.sizePreset,
      ...sizeFields(data),
    },
  });
  revalidatePath(`/sets/${setId}`);
}

export async function deleteSet(setId: string) {
  await prisma.cardSet.delete({ where: { id: setId } });
  revalidatePath("/");
  redirect("/");
}
