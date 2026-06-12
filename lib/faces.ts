import { prisma } from "@/lib/prisma";

/**
 * Resolve which CardFace id serves as a card's back:
 * explicit per-card back, else the set's default shared back, else null (placeholder).
 */
export function resolveBackFaceId(
  card: { backFaceId: string | null },
  set: { defaultBackId: string | null },
) {
  return card.backFaceId ?? set.defaultBackId ?? null;
}

export async function faceWithActiveImage(faceId: string) {
  return prisma.cardFace.findUnique({
    where: { id: faceId },
    include: { images: { orderBy: { createdAt: "desc" } } },
  });
}
