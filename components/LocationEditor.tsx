"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCardInLocation,
  createLocationBackBase,
  createLocationPanorama,
  deleteLocation,
  reorderLocation,
  setInPanorama,
  splitPanorama,
  updateLocationCard,
  updateLocationMeta,
} from "@/actions/locations";
import { backAlterPrompt } from "@/lib/locations";
import { FaceForm } from "./FaceForm";
import type { Card, CardSet, FaceWithImages, Location } from "@/lib/types";

const inputCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type CardWithFaces = Card & { front: FaceWithImages; back: FaceWithImages | null };
type FullLocation = Location & {
  backBase: FaceWithImages | null;
  panorama: FaceWithImages | null;
  cards: CardWithFaces[];
};

export function LocationEditor({
  set,
  location,
  widthMm,
  heightMm,
}: {
  set: CardSet;
  location: FullLocation;
  widthMm: number;
  heightMm: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const members = location.cards.filter((c) => c.inPanorama);
  const refresh = () => router.refresh();
  const run = (fn: () => Promise<unknown>) => startTransition(async () => { await fn(); refresh(); });

  return (
    <div className="space-y-8">
      <form
        action={(fd) => updateLocationMeta(location.id, fd)}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="text-xs font-medium text-zinc-500">
          Location name
          <input name="name" defaultValue={location.name} className={`${inputCls} mt-1 block w-56`} />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Description
          <input name="description" defaultValue={location.description ?? ""} className={`${inputCls} mt-1 block w-72`} />
        </label>
        <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          Save
        </button>
      </form>

      {/* Generic numbered back design */}
      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">Generic back design</h2>
        <p className="text-xs text-zinc-400">
          The shared back for non-panorama cards. Each card gets a copy showing its position label; use
          “Alter image” on a card below to bake in its letter.
        </p>
        {location.backBase ? (
          <FaceForm face={location.backBase} widthMm={widthMm} heightMm={heightMm} />
        ) : (
          <button
            onClick={() => run(() => createLocationBackBase(location.id))}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Create back base
          </button>
        )}
      </section>

      {/* Panorama */}
      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Panorama (spanning back)</h2>
          {location.panorama && (
            <button
              onClick={() => run(() => splitPanorama(location.id))}
              disabled={members.length === 0 || !location.panorama?.activeImageId}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              title={members.length === 0 ? "Mark cards as panorama members first" : "Slice into member backs"}
            >
              Split to cards ({members.length})
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-400">
          One wide image whose slices become the backs of the {members.length} panorama member
          {members.length === 1 ? "" : "s"} (laid side by side they reconstruct the scene). Generate it,
          then “Split to cards”, then alter each slice to add text.
        </p>
        {location.panorama ? (
          <FaceForm
            face={location.panorama}
            widthMm={Math.max(1, members.length) * widthMm}
            heightMm={heightMm}
          />
        ) : (
          <button
            onClick={() => run(() => createLocationPanorama(location.id))}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Create panorama
          </button>
        )}
      </section>

      {/* Cards */}
      <section className="space-y-3">
        <h2 className="font-semibold">Cards</h2>
        <p className="text-xs text-zinc-400">
          Card A is the main/establishing card. Reordering relabels but does not regenerate back images —
          re-run “Alter image” after reordering.
        </p>
        <div className="space-y-3">
          {location.cards.map((card, i) => (
            <LocationCardRow
              key={card.id}
              set={set}
              location={location}
              card={card}
              index={i}
              total={location.cards.length}
              widthMm={widthMm}
              heightMm={heightMm}
              onRun={run}
            />
          ))}
        </div>
        <form action={createCardInLocation.bind(null, location.id)} className="flex gap-2">
          <input name="name" placeholder="New card name" required className={`${inputCls} w-56`} />
          <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
            + Add card
          </button>
        </form>
      </section>

      <form action={deleteLocation.bind(null, location.id)}>
        <button className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950">
          Delete location
        </button>
      </form>
    </div>
  );
}

function LocationCardRow({
  set,
  location,
  card,
  index,
  total,
  widthMm,
  heightMm,
  onRun,
}: {
  set: CardSet;
  location: FullLocation;
  card: CardWithFaces;
  index: number;
  total: number;
  widthMm: number;
  heightMm: number;
  onRun: (fn: () => Promise<unknown>) => void;
}) {
  const [open, setOpen] = useState(false);

  function move(dir: -1 | 1) {
    const ids = location.cards.map((c) => c.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    onRun(() => reorderLocation(location.id, ids));
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-end gap-3">
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-sm font-bold dark:bg-zinc-800">
          {card.positionLabel ?? "?"}
        </span>
        <form action={(fd) => updateLocationCard(card.id, fd)} className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-zinc-500">
            Name
            <input name="name" defaultValue={card.name} className={`${inputCls} mt-1 block w-40`} />
          </label>
          <label className="text-xs font-medium text-zinc-500">
            Label
            <input name="positionLabel" defaultValue={card.positionLabel ?? ""} className={`${inputCls} mt-1 block w-16`} />
          </label>
          <label className="text-xs font-medium text-zinc-500">
            Back text (override)
            <input name="backText" defaultValue={card.backText ?? ""} placeholder="e.g. No entry" className={`${inputCls} mt-1 block w-40`} />
          </label>
          <button className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Save
          </button>
        </form>

        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={card.inPanorama}
            onChange={(e) => onRun(() => setInPanorama(card.id, e.target.checked))}
            className="h-4 w-4"
          />
          Panorama member
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => move(-1)} disabled={index === 0} className="rounded border px-2 text-sm disabled:opacity-30">↑</button>
          <button onClick={() => move(1)} disabled={index === total - 1} className="rounded border px-2 text-sm disabled:opacity-30">↓</button>
          <Link
            href={`/sets/${set.id}/cards/${card.id}`}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Edit front
          </Link>
          <button onClick={() => setOpen(!open)} className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            {open ? "Hide back" : "Edit back"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          {card.inPanorama ? (
            card.back?.activeImageId ? (
              <FaceForm
                face={card.back}
                widthMm={widthMm}
                heightMm={heightMm}
                defaultAlterPrompt={backAlterPrompt(card)}
              />
            ) : (
              <p className="text-sm text-zinc-400">
                Panorama member — generate the panorama and click “Split to cards” to fill this back, then
                alter it here to add text.
              </p>
            )
          ) : card.back ? (
            <FaceForm
              face={card.back}
              widthMm={widthMm}
              heightMm={heightMm}
              defaultReferenceImageId={location.backBase?.activeImageId ?? null}
              defaultAlterPrompt={backAlterPrompt(card)}
            />
          ) : (
            <p className="text-sm text-zinc-400">
              No back yet — create the generic back base above; new cards then get a numbered copy.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
