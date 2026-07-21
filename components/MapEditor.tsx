"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMap, setMapLandscape, splitMap, updateMapMeta } from "@/actions/maps";
import { MAP_COLS, MAP_ROWS, MAP_TILES, mapSizeMm } from "@/lib/maps";
import { FaceForm } from "./FaceForm";
import { CardFacePreview } from "./CardFacePreview";
import type { Card, FaceWithImages, Map as MapModel } from "@/lib/types";

const inputCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type MapCard = Card & { front: FaceWithImages };
type FullMap = MapModel & {
  master: FaceWithImages | null;
  back: FaceWithImages | null;
  cards: MapCard[];
};

export function MapEditor({
  setId,
  map,
  widthMm,
  heightMm,
}: {
  setId: string;
  map: FullMap;
  widthMm: number;
  heightMm: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const masterMm = mapSizeMm({ widthMm, heightMm }, map.landscape);
  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="space-y-8">
      <form
        action={(fd) => updateMapMeta(map.id, fd)}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="text-xs font-medium text-zinc-500">
          Map name
          <input name="name" defaultValue={map.name} className={`${inputCls} mt-1 block w-56`} />
        </label>
        <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          Save
        </button>
      </form>

      {/* Master image, sliced into the card fronts */}
      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Map image</h2>
          <button
            onClick={() => run(() => splitMap(map.id))}
            disabled={!map.master?.activeImageId}
            title={map.master?.activeImageId ? "Slice into the card fronts" : "Generate the map image first"}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Split to {MAP_TILES} cards
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={map.landscape}
            onChange={(e) => run(() => setMapLandscape(map.id, e.target.checked))}
            className="h-4 w-4"
          />
          Landscape map — the image is drawn wide ({masterMm.widthMm}×{masterMm.heightMm} mm) and turned
          a quarter turn when sliced, so the cards print portrait and the assembled map reads landscape
        </label>
        <p className="text-xs text-zinc-400">
          One image cut into a {MAP_COLS}×{MAP_ROWS} grid of card fronts that tile back together on the
          table. Generate it, then “Split to {MAP_TILES} cards”. A {MAP_COLS}×{MAP_ROWS} grid has the
          same shape as a single card, so nothing is cropped away.
          {" Regenerate the image after switching orientation — an old master would just get cropped."}
        </p>
        {map.master && (
          <FaceForm face={map.master} widthMm={masterMm.widthMm} heightMm={masterMm.heightMm} />
        )}
      </section>

      {/* Assembled grid */}
      <section className="space-y-3">
        <h2 className="font-semibold">Cards</h2>
        <p className="text-xs text-zinc-400">
          The cards as they lie on the table
          {map.landscape ? ", the grid given its quarter turn" : ""}. Click one to rename it or set its
          copy count — regenerating its front there replaces that slice.
        </p>
        {/*
          The printed grid is always portrait (portrait cards, MAP_COLS x MAP_ROWS).
          For a landscape map splitMap turned the master 90° clockwise, so the grid is
          shown turned back — hence the swapped inner width/height percentages.
        */}
        <div
          className="relative w-full max-w-xl"
          style={{ aspectRatio: `${masterMm.widthMm} / ${masterMm.heightMm}` }}
        >
          <div
            className="absolute left-1/2 top-1/2 grid overflow-hidden rounded-xl"
            style={{
              gridTemplateColumns: `repeat(${MAP_COLS}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${MAP_ROWS}, minmax(0, 1fr))`,
              width: map.landscape ? `${(100 * masterMm.heightMm) / masterMm.widthMm}%` : "100%",
              height: map.landscape ? `${(100 * masterMm.widthMm) / masterMm.heightMm}%` : "100%",
              transform: `translate(-50%, -50%) rotate(${map.landscape ? -90 : 0}deg)`,
            }}
          >
            {map.cards.map((card) => (
              <Link
                key={card.id}
                href={`/sets/${setId}/cards/${card.id}`}
                className="group relative block h-full"
              >
                <CardFacePreview
                  activeImageId={card.front.activeImageId}
                  widthMm={widthMm}
                  heightMm={heightMm}
                  label={card.name}
                  // Gapless and square-cornered so the tiling reads as one image.
                  className="h-full rounded-none! border-dashed group-hover:opacity-90"
                />
                {/* Turned back so the letter stays upright while the grid is rotated. */}
                <span
                  className="absolute left-1.5 top-1.5 origin-top-left rounded bg-black/60 px-1.5 py-0.5 text-xs font-bold text-white"
                  style={map.landscape ? { transform: "rotate(90deg) translateY(-100%)" } : undefined}
                >
                  {card.positionLabel ?? "?"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Shared back */}
      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">Shared back</h2>
        <p className="text-xs text-zinc-400">
          All {MAP_TILES} map cards print with this one back design.
        </p>
        {map.back && <FaceForm face={map.back} widthMm={widthMm} heightMm={heightMm} />}
      </section>

      <button
        onClick={() => {
          if (!confirm(`Delete map “${map.name}”? Its ${MAP_TILES} cards and images are removed too.`)) return;
          run(() => deleteMap(map.id));
        }}
        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
      >
        Delete map
      </button>
    </div>
  );
}
