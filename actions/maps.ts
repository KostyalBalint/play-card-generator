"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { sizeForSet } from "@/lib/sizes";
import { writeStorageFile, readStorageFile } from "@/lib/storage";
import { coverCrop } from "@/lib/imagecrop";
import { labelForIndex } from "@/lib/locations";
import { MAP_TILES, mapSizeMm, mapTileRects } from "@/lib/maps";

// Same per-face cleanup filter as actions/locations.ts: a face owned by no card
// and not a shared/base design.
const ORPHAN = { sharedBackSetId: null, backOfCards: { none: {} }, frontOfCard: null } as const;

/**
 * Create a map with its master face, its shared back face and all MAP_TILES
 * cards up front — unlike a location's optional panorama, a map is always the
 * full grid, so there is no half-built state to render.
 */
export async function createMap(setId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim() || "New map";
  const maxOrder = await prisma.map.aggregate({ where: { setId }, _max: { orderIndex: true } });
  const maxCardOrder = await prisma.card.aggregate({ where: { setId }, _max: { orderIndex: true } });

  const master = await prisma.cardFace.create({ data: { textLayout: "NONE" } });
  const back = await prisma.cardFace.create({ data: { textLayout: "NONE", title: `${name} back` } });
  const map = await prisma.map.create({
    data: {
      setId,
      name,
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
      masterId: master.id,
      backId: back.id,
    },
  });

  const base = (maxCardOrder._max.orderIndex ?? -1) + 1;
  for (let i = 0; i < MAP_TILES; i++) {
    await prisma.card.create({
      data: {
        set: { connect: { id: setId } },
        map: { connect: { id: map.id } },
        name: `${name} ${labelForIndex(i)}`,
        positionLabel: labelForIndex(i),
        orderIndex: base + i,
        // All map cards share the map's one back design.
        back: { connect: { id: back.id } },
        front: { create: { textLayout: "NONE" } },
      },
    });
  }

  redirect(`/sets/${setId}/maps/${map.id}`);
}

export async function updateMapMeta(mapId: string, formData: FormData) {
  const map = await prisma.map.update({
    where: { id: mapId },
    data: { name: String(formData.get("name") ?? "") },
  });
  revalidatePath(`/sets/${map.setId}/maps/${mapId}`);
}

/**
 * Switch the map between a landscape and a portrait assembly. The existing
 * master keeps its old aspect until it is regenerated — split would just crop it.
 */
export async function setMapLandscape(mapId: string, value: boolean) {
  const map = await prisma.map.update({ where: { id: mapId }, data: { landscape: value } });
  revalidatePath(`/sets/${map.setId}/maps/${mapId}`);
}

export async function deleteMap(mapId: string) {
  const map = await prisma.map.findUniqueOrThrow({
    where: { id: mapId },
    include: { cards: true },
  });
  // The quadrant fronts are meaningless without the map, so the cards go too.
  const faceIds = [
    ...map.cards.map((c) => c.frontFaceId),
    ...[map.masterId, map.backId].filter((x): x is string => !!x),
  ];
  await prisma.$transaction([
    prisma.card.deleteMany({ where: { mapId } }),
    prisma.map.delete({ where: { id: mapId } }),
    prisma.cardFace.deleteMany({ where: { id: { in: faceIds }, ...ORPHAN } }),
  ]);
  revalidatePath(`/sets/${map.setId}`);
  redirect(`/sets/${map.setId}`);
}

/** Slice the map's master image into the member cards' front images (manual step). */
export async function splitMap(mapId: string) {
  const map = await prisma.map.findUniqueOrThrow({
    where: { id: mapId },
    include: {
      set: true,
      master: { include: { images: true } },
      cards: { orderBy: { orderIndex: "asc" } },
    },
  });
  const active = map.master?.images.find(
    (img) => img.id === map.master?.activeImageId && img.status === "DONE" && img.filePath,
  );
  if (!active?.filePath) throw new Error("Generate the map image first");

  const cardSize = sizeForSet(map.set);
  const master = mapSizeMm(cardSize, map.landscape);

  // The master is stored uncropped; crop it to the assembled map's aspect first so
  // the tiles are each exactly card-aspect and line up seamlessly on the table.
  // A square grid of card-aspect tiles has the card's own aspect (turned 90° for
  // a landscape map, which is undone here so the printed cards stay portrait).
  const raw = await readStorageFile(active.filePath);
  const cropped = await coverCrop(raw, master.widthMm / master.heightMm);
  const source = map.landscape
    ? await sharp(cropped).rotate(90).png().toBuffer()
    : cropped;
  const meta = await sharp(source).metadata();
  const W = meta.width ?? 1024;
  const H = meta.height ?? 1536;
  const rects = mapTileRects(W, H);

  for (let i = 0; i < map.cards.length && i < rects.length; i++) {
    const card = map.cards[i];
    const rect = rects[i];
    const png = await sharp(source).extract(rect).png().toBuffer();

    // Map cards already own a front face — the slice just becomes its new image.
    const record = await prisma.generatedImage.create({
      data: {
        faceId: card.frontFaceId,
        status: "PENDING",
        resolvedPrompt: "map slice",
        sourceImageId: active.id,
      },
    });
    const filePath = `images/${map.setId}/${record.id}.png`;
    await writeStorageFile(filePath, png);
    await prisma.$transaction([
      prisma.generatedImage.update({
        where: { id: record.id },
        data: { status: "DONE", filePath, widthPx: rect.width, heightPx: rect.height },
      }),
      prisma.cardFace.update({ where: { id: card.frontFaceId }, data: { activeImageId: record.id } }),
    ]);
  }
  revalidatePath(`/sets/${map.setId}/maps/${mapId}`);
}
