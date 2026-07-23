"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deleteStorageFile } from "@/lib/storage";

/**
 * Uploaded reference pictures (ReferenceImage) are set-scoped assets: never
 * printed on a card, but selectable as a visual reference on any face's
 * generate control (see lib/references + components/FaceForm). Uploading
 * happens over /api/sets/[setId]/references — these actions manage the library.
 */

/** Rename an upload; the picker lists it by name, so the filename is rarely useful. */
export async function renameReference(refId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const ref = await prisma.referenceImage.update({ where: { id: refId }, data: { name } });
  revalidatePath(`/sets/${ref.setId}`);
}

/**
 * Delete an upload and its PNG. Generated art is untouched: an upload-seeded
 * generation stores sourceImageId = null (uploads are not GeneratedImages), so
 * nothing points back here.
 */
export async function deleteReference(refId: string) {
  const ref = await prisma.referenceImage.delete({ where: { id: refId } });
  if (ref.filePath) await deleteStorageFile(ref.filePath);
  revalidatePath(`/sets/${ref.setId}`);
}
