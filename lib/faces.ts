import { prisma } from "@/lib/prisma";

/**
 * Resolve which CardFace id serves as a card's back: explicit per-card back,
 * else — for item cards — the set's chosen item back, else the set's default
 * shared back, else null (placeholder).
 */
export function resolveBackFaceId(
  card: { backFaceId: string | null; isItem?: boolean | null },
  set: { defaultBackId: string | null; itemBackId?: string | null },
) {
  if (card.backFaceId) return card.backFaceId;
  if (card.isItem && set.itemBackId) return set.itemBackId;
  return set.defaultBackId ?? null;
}

export async function faceWithActiveImage(faceId: string) {
  return prisma.cardFace.findUnique({
    where: { id: faceId },
    include: { images: { orderBy: { createdAt: "desc" } } },
  });
}
