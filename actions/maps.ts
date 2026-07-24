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

/** The map's own back face, recreated if it was cleaned up (backId is SetNull). */
async function ownBackId(map: { id: string; name: string; backId: string | null }) {
  if (map.backId) return map.backId;
  const back = await prisma.cardFace.create({
    data: { textLayout: "NONE", title: `${map.name} back` },
  });
  await prisma.map.update({ where: { id: map.id }, data: { backId: back.id } });
  return back.id;
}

/**
 * Which back the map's cards print: the map's own back design ("__own"), the
 * set's default back ("__default") or one of the set's shared backs (its face
 * id). Stored on the cards themselves like every other card's back, so preview
 * and export need no map-specific rule (see lib/faces.resolveBackFaceId).
 */
export async function setMapBack(mapId: string, choice: string) {
  const map = await prisma.map.findUniqueOrThrow({ where: { id: mapId } });
  let backFaceId: string | null;
  if (choice === "__own") backFaceId = await ownBackId(map);
  else if (choice === "__default") backFaceId = null;
  else {
    const face = await prisma.cardFace.findUnique({ where: { id: choice } });
    if (!face || face.sharedBackSetId !== map.setId) {
      throw new Error("Back does not belong to this set");
    }
    backFaceId = face.id;
  }
  await prisma.card.updateMany({ where: { mapId }, data: { backFaceId } });
  revalidatePath(`/sets/${map.setId}/maps/${mapId}`);
  revalidatePath(`/sets/${map.setId}`);
}

/**
 * Toggle the card-driven back overlay for every map card: text drawn over
 * whatever back the map uses — including a shared one, which stays untouched
 * (see lib/overlay).
 */
export async function setMapBackOverlay(mapId: string, value: boolean) {
  const map = await prisma.map.findUniqueOrThrow({ where: { id: mapId } });
  await prisma.card.updateMany({ where: { mapId }, data: { labelOverlay: value } });
  revalidatePath(`/sets/${map.setId}/maps/${mapId}`);
  revalidatePath(`/sets/${map.setId}`);
}

/**
 * The two overlay texts, applied to all map cards at once. An empty label falls
 * back per card to its position letter, so the quadrants stay distinguishable.
 */
export async function updateMapOverlayText(mapId: string, formData: FormData) {
  const map = await prisma.map.findUniqueOrThrow({ where: { id: mapId } });
  const text = (key: string) => {
    const raw = formData.get(key);
    return raw === null ? undefined : String(raw).trim() || null;
  };
  await prisma.card.updateMany({
    where: { mapId },
    data: { backText: text("backText"), overlayCaption: text("overlayCaption") },
  });
  revalidatePath(`/sets/${map.setId}/maps/${mapId}`);
  revalidatePath(`/sets/${map.setId}`);
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
