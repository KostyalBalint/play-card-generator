import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sizeForSet } from "@/lib/sizes";
import { resolveBackFaceId } from "@/lib/faces";
import { setReferences } from "@/lib/references";
import { deleteCard } from "@/actions/cards";
import { CardEditor } from "@/components/CardEditor";

export const dynamic = "force-dynamic";

export default async function CardPage({
  params,
}: {
  params: Promise<{ setId: string; cardId: string }>;
}) {
  const { setId, cardId } = await params;
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      set: { include: { sharedBacks: { include: { images: { orderBy: { createdAt: "desc" } } } } } },
      front: { include: { images: { orderBy: { createdAt: "desc" } } } },
      back: { include: { images: { orderBy: { createdAt: "desc" } } } },
    },
  });
  if (!card || card.setId !== setId) notFound();

  const { set } = card;
  const { widthMm, heightMm } = sizeForSet(set);
  // Effective back: explicit per-card back, else the set's item/default shared back
  const backFaceId = resolveBackFaceId(card, set);
  const back = card.back ?? set.sharedBacks.find((b) => b.id === backFaceId) ?? null;

  // Any front can be generated against another card's art (same flow as "match
  // back side") or an uploaded picture, so a card's look can follow the deck —
  // or a real object.
  const referenceCards = (await setReferences(setId)).filter((r) => r.id !== cardId);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/sets/${set.id}`} className="text-xs text-zinc-400 hover:underline">
            ← {set.name}
          </Link>
          <h1 className="text-2xl font-bold">
            {set.showNumbers && card.number != null ? `#${card.number} ` : ""}
            {card.name}
          </h1>
        </div>
        <form action={deleteCard.bind(null, card.id)}>
          <button className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950">
            Delete card
          </button>
        </form>
      </div>

      <CardEditor
        card={card}
        set={set}
        front={card.front}
        back={back}
        sharedBacks={set.sharedBacks}
        referenceCards={referenceCards}
        widthMm={widthMm}
        heightMm={heightMm}
      />
    </main>
  );
}
