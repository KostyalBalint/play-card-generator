"use client";

import Link from "next/link";
import { createMap } from "@/actions/maps";
import { MAP_COLS, MAP_ROWS } from "@/lib/maps";
import type { Map as MapModel } from "@/lib/types";

export function MapManager({
  setId,
  maps,
}: {
  setId: string;
  maps: (MapModel & { _count: { cards: number } })[];
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {maps.map((map) => (
          <Link
            key={map.id}
            href={`/sets/${setId}/maps/${map.id}`}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="font-semibold">{map.name}</div>
            <div className="mt-2 text-xs text-zinc-400">
              {MAP_COLS}×{MAP_ROWS} grid · {map._count.cards} card
              {map._count.cards === 1 ? "" : "s"}
            </div>
          </Link>
        ))}
      </div>

      <form action={createMap.bind(null, setId)} className="flex gap-2">
        <input
          name="name"
          placeholder="New map name"
          required
          className="w-64 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
          + Add map
        </button>
      </form>
    </div>
  );
}
