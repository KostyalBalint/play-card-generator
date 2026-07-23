import { prisma } from "@/lib/prisma";
import type { ReferenceCard } from "@/lib/types";

/** Pictures uploaded to the set, offered in the same picker as card art. */
async function uploadedReferences(setId: string): Promise<ReferenceCard[]> {
  const uploads = await prisma.referenceImage.findMany({
    where: { setId, filePath: { not: "" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });
  return uploads.map((u) => ({
    id: `upload:${u.id}`,
    imageId: u.id,
    label: u.name,
    kind: "upload" as const,
  }));
}

/** Every card in the set that has a generated front, labelled for a picker. */
async function cardFrontReferences(setId: string): Promise<ReferenceCard[]> {
  const cards = await prisma.card.findMany({
    where: { setId, front: { activeImageId: { not: null } } },
    orderBy: { orderIndex: "asc" },
    include: { front: { select: { activeImageId: true } }, location: { select: { name: true } } },
  });
  return cards.map((c) => ({
    id: c.id,
    imageId: c.front.activeImageId!,
    kind: "card" as const,
    label: c.location
      ? `${c.location.name} ${c.positionLabel ?? ""} — ${c.name}`.replace("  ", " ")
      : c.isItem
        ? `Item ${c.number ?? "?"} — ${c.name}`
        : c.name,
  }));
}

/**
 * Everything in the set that can seed a generation: uploaded pictures first,
 * then card fronts. Callers drop the face they are generating (card fronts keep
 * the card's own id) — the API rejects a reference from another set anyway.
 */
export async function setReferences(setId: string): Promise<ReferenceCard[]> {
  const [uploads, fronts] = await Promise.all([
    uploadedReferences(setId),
    cardFrontReferences(setId),
  ]);
  return [...uploads, ...fronts];
}
