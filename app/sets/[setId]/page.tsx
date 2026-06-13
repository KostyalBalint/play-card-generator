import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sizeForSet } from "@/lib/sizes";
import { createCardAndOpen } from "@/actions/cards";
import { deleteSet } from "@/actions/sets";
import { SetSettingsForm } from "@/components/SetSettingsForm";
import { BackDesignManager } from "@/components/BackDesignManager";
import { LocationManager } from "@/components/LocationManager";
import { CardFacePreview } from "@/components/CardFacePreview";

export const dynamic = "force-dynamic";

export default async function SetPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const set = await prisma.cardSet.findUnique({
    where: { id: setId },
    include: {
      cards: { orderBy: { orderIndex: "asc" }, include: { front: true } },
      sharedBacks: { include: { images: { orderBy: { createdAt: "desc" } } } },
      locations: { orderBy: { orderIndex: "asc" }, include: { _count: { select: { cards: true } } } },
    },
  });
  if (!set) notFound();

  const { widthMm, heightMm } = sizeForSet(set);
  const looseCards = set.cards.filter((c) => c.locationId === null);

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-xs text-zinc-400 hover:underline">
            ← All sets
          </Link>
          <h1 className="text-2xl font-bold">{set.name}</h1>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/sets/${set.id}/pdf`}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Export PDF
          </a>
          <form action={deleteSet.bind(null, set.id)}>
            <button className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950">
              Delete set
            </button>
          </form>
        </div>
      </div>

      <p className="text-xs text-zinc-400">
        Print the PDF at 100% scale, double-sided, <strong>flip on long edge</strong>. Cut marks on the
        front and back pages coincide when the sheet is held against light.
      </p>

      <section className="space-y-3">
        <h2 className="font-semibold">Locations</h2>
        <p className="text-xs text-zinc-400">
          Groups of cards (like T.I.M.E Stories locations): a shared back design, position labels, and an
          optional panorama spanning the members&apos; backs.
        </p>
        <LocationManager setId={set.id} locations={set.locations} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Cards</h2>
        {looseCards.length === 0 && set.cards.length > 0 && (
          <p className="text-xs text-zinc-400">All cards belong to locations.</p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {looseCards.map((card) => (
            <Link key={card.id} href={`/sets/${set.id}/cards/${card.id}`} className="space-y-1">
              <CardFacePreview
                activeImageId={card.front.activeImageId}
                widthMm={widthMm}
                heightMm={heightMm}
                label={card.name}
              />
              <div className="truncate text-xs">
                {set.showNumbers && card.number != null ? `#${card.number} ` : ""}
                {card.name}
                {card.copies > 1 ? ` ×${card.copies}` : ""}
              </div>
            </Link>
          ))}
          <form
            action={createCardAndOpen.bind(null, set.id)}
            className="flex flex-col justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 p-3 dark:border-zinc-700"
            style={{ aspectRatio: `${widthMm} / ${heightMm}` }}
          >
            <input
              name="name"
              placeholder="Card name"
              required
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500">
              + Add card
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Card backs</h2>
        <p className="text-xs text-zinc-400">
          Shared backs can be used by many cards; the default back applies to every card that has no
          explicit back. Individual cards can customize a copy in their editor.
        </p>
        <BackDesignManager set={set} sharedBacks={set.sharedBacks} widthMm={widthMm} heightMm={heightMm} />
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">Set settings</h2>
        <SetSettingsForm set={set} />
      </section>
    </main>
  );
}
