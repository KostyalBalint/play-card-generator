import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createSet } from "@/actions/sets";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sets = await prisma.cardSet.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { cards: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 p-8">
      <h1 className="text-2xl font-bold">Card sets</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sets.map((set) => (
          <Link
            key={set.id}
            href={`/sets/${set.id}`}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="font-semibold">{set.name}</div>
            {set.description && (
              <div className="mt-1 line-clamp-2 text-sm text-zinc-500">{set.description}</div>
            )}
            <div className="mt-2 text-xs text-zinc-400">
              {set._count.cards} card{set._count.cards === 1 ? "" : "s"} · {set.widthMm}×{set.heightMm}{" "}
              mm
            </div>
          </Link>
        ))}
      </div>

      <form
        action={createSet}
        className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="font-semibold">New card set</h2>
        <input
          name="name"
          required
          placeholder="Set name"
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <textarea
          name="stylePrompt"
          rows={2}
          placeholder="Visual style, e.g. “1920s noir, muted sepia palette, ink illustration with film-grain texture”"
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
          Create set
        </button>
      </form>
    </main>
  );
}
