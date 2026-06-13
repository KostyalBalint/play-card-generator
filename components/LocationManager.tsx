"use client";

import Link from "next/link";
import { createLocation } from "@/actions/locations";
import type { Location } from "@/lib/types";

export function LocationManager({
  setId,
  locations,
}: {
  setId: string;
  locations: (Location & { _count: { cards: number } })[];
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((loc) => (
          <Link
            key={loc.id}
            href={`/sets/${setId}/locations/${loc.id}`}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="font-semibold">{loc.name}</div>
            {loc.description && (
              <div className="mt-1 line-clamp-2 text-sm text-zinc-500">{loc.description}</div>
            )}
            <div className="mt-2 text-xs text-zinc-400">
              {loc._count.cards} card{loc._count.cards === 1 ? "" : "s"}
            </div>
          </Link>
        ))}
      </div>

      <form action={createLocation.bind(null, setId)} className="flex gap-2">
        <input
          name="name"
          placeholder="New location name"
          required
          className="w-64 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
          + Add location
        </button>
      </form>
    </div>
  );
}
