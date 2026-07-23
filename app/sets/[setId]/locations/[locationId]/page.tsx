import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sizeForSet } from "@/lib/sizes";
import { setReferences } from "@/lib/references";
import { LocationEditor } from "@/components/LocationEditor";

export const dynamic = "force-dynamic";

const faceInclude = { images: { orderBy: { createdAt: "desc" as const } } };

export default async function LocationPage({
  params,
}: {
  params: Promise<{ setId: string; locationId: string }>;
}) {
  const { setId, locationId } = await params;
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: {
      set: { include: { sharedBacks: { include: faceInclude } } },
      panorama: { include: faceInclude },
      cards: {
        orderBy: { orderIndex: "asc" },
        include: { front: { include: faceInclude }, back: { include: faceInclude } },
      },
    },
  });
  if (!location || location.setId !== setId) notFound();

  const { widthMm, heightMm } = sizeForSet(location.set);
  // Card art + uploaded pictures usable as a visual reference for the panorama
  // and for the members' fronts (each card drops itself — see LocationEditor).
  const references = await setReferences(setId);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-8">
      <div>
        <Link href={`/sets/${setId}`} className="text-xs text-zinc-400 hover:underline">
          ← {location.set.name}
        </Link>
        <h1 className="text-2xl font-bold">{location.name}</h1>
      </div>
      <LocationEditor
        set={location.set}
        sharedBacks={location.set.sharedBacks}
        location={location}
        references={references}
        widthMm={widthMm}
        heightMm={heightMm}
      />
    </main>
  );
}
