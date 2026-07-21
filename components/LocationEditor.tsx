"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCardInLocation,
  createLocationPanorama,
  deleteCardFromLocation,
  deleteLocation,
  reorderLocation,
  splitPanorama,
  updateLocationMeta,
} from "@/actions/locations";
import { overlayFor } from "@/lib/overlay";
import { FaceForm } from "./FaceForm";
import { CardFacePreview } from "./CardFacePreview";
import { CardFaceModal } from "./CardFaceModal";
import type { Card, CardSet, FaceWithImages, Location } from "@/lib/types";

const inputCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type CardWithFaces = Card & { front: FaceWithImages; back: FaceWithImages | null };
type FullLocation = Location & {
  panorama: FaceWithImages | null;
  cards: CardWithFaces[];
};

/** Whether a face has a ready image / is mid-generation / failed / empty. */
function faceState(face: FaceWithImages | null): "none" | "pending" | "done" | "failed" {
  if (!face) return "none";
  if (face.activeImageId) return "done";
  const latest = face.images[0];
  if (latest?.status === "PENDING") return "pending";
  if (latest?.status === "FAILED") return "failed";
  return "none";
}

export function LocationEditor({
  set,
  sharedBacks,
  location,
  widthMm,
  heightMm,
}: {
  set: CardSet;
  sharedBacks: FaceWithImages[];
  location: FullLocation;
  widthMm: number;
  heightMm: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const members = location.cards.filter((c) => c.inPanorama);
  const refresh = () => router.refresh();
  const run = (fn: () => Promise<unknown>) => startTransition(async () => { await fn(); refresh(); });

  const openCard = location.cards.find((c) => c.id === openCardId) ?? null;
  const defaultBack = sharedBacks.find((b) => b.id === set.defaultBackId) ?? null;

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

      {/* Panorama spanning back */}
      <section className="space-y-3">
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
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
            One wide image sliced into the backs of the {members.length} panorama member
            {members.length === 1 ? "" : "s"}. Generate it, then “Split to cards” — each slice&apos;s
            position letter is drawn as an overlay automatically (no per-card generation).
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
        </div>
      </section>

      {/* Cards grid */}
      <section className="space-y-3">
        <h2 className="font-semibold">Cards</h2>
        <p className="text-xs text-zinc-400">
          Card A is the main/establishing card. Click a card to edit its front and back. Reordering
          relabels live — panorama overlays follow automatically; baked generic backs need re-altering.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {location.cards.map((card, i) => (
            <CardTile
              key={card.id}
              card={card}
              defaultBack={defaultBack}
              locationName={location.name}
              index={i}
              total={location.cards.length}
              widthMm={widthMm}
              heightMm={heightMm}
              onOpen={() => setOpenCardId(card.id)}
              onMove={(dir) => {
                const ids = location.cards.map((c) => c.id);
                const j = i + dir;
                if (j < 0 || j >= ids.length) return;
                [ids[i], ids[j]] = [ids[j], ids[i]];
                run(() => reorderLocation(location.id, ids));
              }}
              onDelete={() => {
                const label = card.positionLabel ?? card.name;
                if (!confirm(`Delete card ${label} (“${card.name}”)? Its images are removed too.`)) return;
                if (openCardId === card.id) setOpenCardId(null);
                run(() => deleteCardFromLocation(card.id));
              }}
            />
          ))}
          <form
            action={createCardInLocation.bind(null, location.id)}
            className="flex flex-col justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 p-3 dark:border-zinc-700"
            style={{ aspectRatio: `${widthMm} / ${heightMm}` }}
          >
            <input name="name" placeholder="Card name" required className={`${inputCls} w-full text-xs`} />
            <button className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500">
              + Add card
            </button>
          </form>
        </div>
      </section>

      <form action={deleteLocation.bind(null, location.id)}>
        <button className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950">
          Delete location
        </button>
      </form>

      {openCard && (
        <CardFaceModal
          set={set}
          card={openCard}
          sharedBacks={sharedBacks}
          locationName={location.name}
          widthMm={widthMm}
          heightMm={heightMm}
          onClose={() => setOpenCardId(null)}
        />
      )}
    </div>
  );
}

const STATUS_DOT: Record<ReturnType<typeof faceState>, string> = {
  none: "bg-zinc-300 dark:bg-zinc-600",
  pending: "bg-amber-400 animate-pulse",
  done: "bg-emerald-500",
  failed: "bg-red-500",
};

function CardTile({
  card,
  defaultBack,
  locationName,
  index,
  total,
  widthMm,
  heightMm,
  onOpen,
  onMove,
  onDelete,
}: {
  card: CardWithFaces;
  defaultBack: FaceWithImages | null;
  locationName: string;
  index: number;
  total: number;
  widthMm: number;
  heightMm: number;
  onOpen: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  // Cards with no own back fall back to the set's default shared back.
  const back = card.back ?? defaultBack;
  const overlay = overlayFor(card, back, locationName);
  const frontState = faceState(card.front);
  const backState = faceState(back);
  const backIsMain = true;

  return (
    <div className="group space-y-1.5">
      <button
        onClick={onOpen}
        className="relative block w-full text-left transition hover:opacity-95"
        title="Edit front & back"
      >
        <CardFacePreview
          activeImageId={backIsMain ? back?.activeImageId : card.front.activeImageId}
          widthMm={widthMm}
          heightMm={heightMm}
          label={backIsMain ? "back" : card.name}
          overlay={backIsMain ? overlay : null}
          className="ring-1 ring-transparent group-hover:ring-blue-400"
        />
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-xs font-bold text-white">
          {card.positionLabel ?? "?"}
        </span>
        {/* Other face inset, bottom-right */}
        <span className="absolute bottom-1.5 right-1.5 w-1/3 overflow-hidden rounded-md shadow ring-1 ring-black/20">
          <CardFacePreview
            activeImageId={backIsMain ? card.front.activeImageId : back?.activeImageId}
            widthMm={widthMm}
            heightMm={heightMm}
            label={backIsMain ? "front" : "back"}
            overlay={backIsMain ? null : overlay}
          />
        </span>
        {card.inPanorama && (
          <span className="absolute right-1.5 top-1.5 rounded bg-violet-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
            pano
          </span>
        )}
      </button>

      <div className="flex items-center gap-1.5 text-xs">
        <span className="flex items-center gap-1" title={`front: ${frontState}`}>
          <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[frontState]}`} />F
        </span>
        <span className="flex items-center gap-1" title={`back: ${backState}`}>
          <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[backState]}`} />B
        </span>
        <span className="ml-auto flex gap-0.5">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="rounded border px-1 disabled:opacity-30 dark:border-zinc-700"
          >
            ↑
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="rounded border px-1 disabled:opacity-30 dark:border-zinc-700"
          >
            ↓
          </button>
          <button
            onClick={onDelete}
            title="Delete this card"
            className="rounded border border-red-300 px-1 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            ✕
          </button>
        </span>
      </div>
      <div className="truncate text-xs text-zinc-500">{card.name}</div>
    </div>
  );
}
