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
  showNumbers: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  sizePreset: z.enum(["POKER", "TAROT", "IMAGE_2_3", "CUSTOM"]).default("TAROT"),
  widthMm: z.coerce.number().positive().max(200).default(70),
  heightMm: z.coerce.number().positive().max(287).default(120),
  fitToPage: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  exportIndex: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
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
      showNumbers: data.showNumbers,
      sizePreset: data.sizePreset,
      fitToPage: data.fitToPage,
      exportIndex: data.exportIndex,
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
      showNumbers: data.showNumbers,
      sizePreset: data.sizePreset,
      fitToPage: data.fitToPage,
      exportIndex: data.exportIndex,
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
