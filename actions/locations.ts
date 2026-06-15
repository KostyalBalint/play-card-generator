"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { sizeForSet } from "@/lib/sizes";
import { writeStorageFile, readStorageFile } from "@/lib/storage";
import { coverCrop } from "@/lib/imagecrop";
import { labelForIndex } from "@/lib/locations";

// Per-card face cleanup filter — same as actions/backs.ts: a face owned by no
// card and not a shared/location base.
const ORPHAN = { sharedBackSetId: null, backOfCards: { none: {} }, frontOfCard: null } as const;

export async function createLocation(setId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim() || "New location";
  const max = await prisma.location.aggregate({ where: { setId }, _max: { orderIndex: true } });
  const location = await prisma.location.create({
    data: { setId, name, orderIndex: (max._max.orderIndex ?? -1) + 1 },
  });
  redirect(`/sets/${setId}/locations/${location.id}`);
}

export async function updateLocationMeta(locationId: string, formData: FormData) {
  const loc = await prisma.location.update({
    where: { id: locationId },
    data: {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || null,
    },
  });
  revalidatePath(`/sets/${loc.setId}/locations/${locationId}`);
}

export async function deleteLocation(locationId: string) {
  const loc = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
  const baseIds = [loc.backBaseId, loc.panoramaId].filter((x): x is string => !!x);
  await prisma.$transaction([
    // Keep the cards as standalone; they retain their own front + back faces.
    prisma.card.updateMany({ where: { locationId }, data: { locationId: null, inPanorama: false } }),
    prisma.location.delete({ where: { id: locationId } }),
    prisma.cardFace.deleteMany({ where: { id: { in: baseIds }, ...ORPHAN } }),
  ]);
  revalidatePath(`/sets/${loc.setId}`);
  redirect(`/sets/${loc.setId}`);
}

export async function createLocationBackBase(locationId: string) {
  const loc = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
  const face = await prisma.cardFace.create({ data: { textLayout: "NONE" } });
  await prisma.location.update({ where: { id: locationId }, data: { backBaseId: face.id } });
  revalidatePath(`/sets/${loc.setId}/locations/${locationId}`);
}

export async function createLocationPanorama(locationId: string) {
  const loc = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
  const face = await prisma.cardFace.create({ data: { textLayout: "NONE" } });
  await prisma.location.update({ where: { id: locationId }, data: { panoramaId: face.id } });
  revalidatePath(`/sets/${loc.setId}/locations/${locationId}`);
}

export async function createCardInLocation(locationId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim() || "New card";
  const loc = await prisma.location.findUniqueOrThrow({
    where: { id: locationId },
    include: { backBase: true, cards: true },
  });
  const label = labelForIndex(loc.cards.length);
  const maxOrder = await prisma.card.aggregate({ where: { setId: loc.setId }, _max: { orderIndex: true } });

  const card = await prisma.card.create({
    data: {
      set: { connect: { id: loc.setId } },
      location: { connect: { id: locationId } },
      positionLabel: label,
      name,
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
      front: { create: { textLayout: "TITLE_BANNER", title: name } },
    },
  });

  // Generic numbered back = a per-card variant of the location's back base.
  if (loc.backBase) {
    const back = await prisma.cardFace.create({
      data: {
        basedOnFaceId: loc.backBase.id,
        variantLabel: label,
        title: label,
        textLayout: loc.backBase.textLayout,
        imagePrompt: loc.backBase.imagePrompt,
      },
    });
    await prisma.card.update({ where: { id: card.id }, data: { backFaceId: back.id } });
  }
  revalidatePath(`/sets/${loc.setId}/locations/${locationId}`);
}

export async function updateLocationCard(cardId: string, formData: FormData) {
  const positionLabel = String(formData.get("positionLabel") ?? "").trim() || null;
  const backText = String(formData.get("backText") ?? "").trim() || null;
  const card = await prisma.card.update({
    where: { id: cardId },
    data: { name: String(formData.get("name") ?? ""), positionLabel, backText },
  });
  // Keep the generic back variant's text in sync (does NOT regenerate the image).
  if (card.backFaceId) {
    await prisma.cardFace.updateMany({
      where: { id: card.backFaceId, basedOnFaceId: { not: null } },
      data: { variantLabel: positionLabel, title: backText ?? positionLabel },
    });
  }
  if (card.locationId) revalidatePath(`/sets/${card.setId}/locations/${card.locationId}`);
}

/** Toggle a card in/out of the location's panorama (its back becomes a slice / generic back). */
export async function setInPanorama(cardId: string, value: boolean) {
  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: { location: { include: { backBase: true } } },
  });
  const oldBackId = card.backFaceId;

  let newBackId: string | null = null;
  if (!value && card.location?.backBase) {
    // Leaving the panorama → recreate a generic numbered back variant.
    const back = await prisma.cardFace.create({
      data: {
        basedOnFaceId: card.location.backBase.id,
        variantLabel: card.positionLabel,
        title: card.backText ?? card.positionLabel,
        textLayout: card.location.backBase.textLayout,
        imagePrompt: card.location.backBase.imagePrompt,
      },
    });
    newBackId = back.id;
  }
  // Repoint first, then clean up the old per-card back face.
  await prisma.card.update({
    where: { id: cardId },
    data: { inPanorama: value, backFaceId: newBackId },
  });
  if (oldBackId) {
    await prisma.cardFace.deleteMany({ where: { id: oldBackId, ...ORPHAN } });
  }
  if (card.locationId) revalidatePath(`/sets/${card.setId}/locations/${card.locationId}`);
}

/** Slice the location's panorama image into per-member back images (manual step). */
export async function splitPanorama(locationId: string) {
  const loc = await prisma.location.findUniqueOrThrow({
    where: { id: locationId },
    include: {
      set: true,
      panorama: { include: { images: true } },
      cards: { where: { inPanorama: true }, orderBy: { orderIndex: "asc" } },
    },
  });
  const active = loc.panorama?.images.find(
    (img) => img.id === loc.panorama?.activeImageId && img.status === "DONE" && img.filePath,
  );
  if (!active?.filePath) throw new Error("Generate the panorama image first");
  if (loc.cards.length === 0) throw new Error("Mark at least one card as a panorama member");

  const { widthMm, heightMm } = sizeForSet(loc.set);
  const n = loc.cards.length;

  // The master is stored uncropped; crop it to the intended wide ratio first so the
  // N equal strips are each exactly card-aspect and tile seamlessly.
  const raw = await readStorageFile(active.filePath);
  const source = await coverCrop(raw, (n * widthMm) / heightMm);
  const meta = await sharp(source).metadata();
  const W = meta.width ?? 1536;
  const H = meta.height ?? 1024;
  const stripW = Math.floor(W / n);

  for (let i = 0; i < n; i++) {
    const card = loc.cards[i];
    const left = i * stripW;
    const sliceW = i === n - 1 ? W - left : stripW;
    const cropW = sliceW;
    const cropH = H;
    const png = await sharp(source)
      .extract({ left, top: 0, width: sliceW, height: H })
      .png()
      .toBuffer();

    // Each member needs a dedicated, non-variant back face to hold its slice.
    let backFaceId = card.backFaceId;
    if (backFaceId) {
      const face = await prisma.cardFace.findUnique({ where: { id: backFaceId } });
      if (!face || face.basedOnFaceId !== null || face.sharedBackSetId !== null) backFaceId = null;
    }
    if (!backFaceId) {
      const created = await prisma.cardFace.create({ data: { textLayout: "NONE" } });
      backFaceId = created.id;
      await prisma.card.update({ where: { id: card.id }, data: { backFaceId } });
    }

    const record = await prisma.generatedImage.create({
      data: { faceId: backFaceId, status: "PENDING", resolvedPrompt: "panorama slice", sourceImageId: active.id },
    });
    const filePath = `images/${loc.setId}/${record.id}.png`;
    await writeStorageFile(filePath, png);
    await prisma.$transaction([
      prisma.generatedImage.update({
        where: { id: record.id },
        data: { status: "DONE", filePath, widthPx: cropW, heightPx: cropH },
      }),
      prisma.cardFace.update({ where: { id: backFaceId }, data: { activeImageId: record.id } }),
    ]);
  }
  revalidatePath(`/sets/${loc.setId}/locations/${locationId}`);
}

export async function reorderLocation(locationId: string, orderedCardIds: string[]) {
  const loc = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
  await prisma.$transaction(
    orderedCardIds.flatMap((cardId, i) => {
      const label = labelForIndex(i);
      return [
        prisma.card.update({ where: { id: cardId }, data: { positionLabel: label, orderIndex: i } }),
        // Sync generic back variant text (image still needs re-alter to show it).
        prisma.cardFace.updateMany({
          where: { backOfCards: { some: { id: cardId } }, basedOnFaceId: { not: null } },
          data: { variantLabel: label, title: label },
        }),
      ];
    }),
  );
  revalidatePath(`/sets/${loc.setId}/locations/${locationId}`);
}
