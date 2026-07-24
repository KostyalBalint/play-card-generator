import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sizeForSet } from "@/lib/sizes";
import { setReferences } from "@/lib/references";
import { MapEditor } from "@/components/MapEditor";

export const dynamic = "force-dynamic";

const faceInclude = { images: { orderBy: { createdAt: "desc" as const } } };

export default async function MapPage({
  params,
}: {
  params: Promise<{ setId: string; mapId: string }>;
}) {
  const { setId, mapId } = await params;
  const map = await prisma.map.findUnique({
    where: { id: mapId },
    include: {
      set: true,
      master: { include: faceInclude },
      back: { include: faceInclude },
      cards: { orderBy: { orderIndex: "asc" }, include: { front: { include: faceInclude } } },
    },
  });
  if (!map || map.setId !== setId) notFound();

  const { widthMm, heightMm } = sizeForSet(map.set);
  // Card art + uploaded pictures usable as a visual reference for the map image.
  // This map's own master is dropped: referencing itself is the "alter" flow.
  const references = (await setReferences(setId)).filter((r) => r.id !== `map:${mapId}`);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-8">
      <div>
        <Link href={`/sets/${setId}`} className="text-xs text-zinc-400 hover:underline">
          ← {map.set.name}
        </Link>
        <h1 className="text-2xl font-bold">{map.name}</h1>
      </div>
      <MapEditor setId={setId} map={map} references={references} widthMm={widthMm} heightMm={heightMm} />
    </main>
  );
}
