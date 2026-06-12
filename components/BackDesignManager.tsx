"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createBackVariant,
  createSharedBack,
  deleteSharedBack,
  setDefaultBack,
} from "@/actions/backs";
import { FaceForm } from "./FaceForm";
import { CardFacePreview } from "./CardFacePreview";
import type { CardSet, FaceWithImages } from "@/lib/types";

export function BackDesignManager({
  set,
  sharedBacks,
  widthMm,
  heightMm,
}: {
  set: CardSet;
  sharedBacks: FaceWithImages[];
  widthMm: number;
  heightMm: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);

  // Group: bases (incl. variants whose base vanished) with their variants beneath
  const baseIds = new Set(sharedBacks.map((b) => b.id));
  const bases = sharedBacks.filter((b) => !b.basedOnFaceId || !baseIds.has(b.basedOnFaceId));
  const variantsOf = (baseId: string) => sharedBacks.filter((b) => b.basedOnFaceId === baseId);

  const open = sharedBacks.find((b) => b.id === openId) ?? null;
  const openBase = open?.basedOnFaceId
    ? sharedBacks.find((b) => b.id === open.basedOnFaceId) ?? null
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {bases.map((back) => (
          <div key={back.id} className="w-44 space-y-2 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
            <BackTile
              back={back}
              label={back.title ?? "Back"}
              active={openId === back.id}
              widthMm={widthMm}
              heightMm={heightMm}
              isDefault={set.defaultBackId === back.id}
              onOpen={() => setOpenId(openId === back.id ? null : back.id)}
              onMakeDefault={() =>
                startTransition(async () => {
                  await setDefaultBack(set.id, back.id);
                  router.refresh();
                })
              }
              onDelete={() =>
                startTransition(async () => {
                  await deleteSharedBack(set.id, back.id);
                  if (openId === back.id) setOpenId(null);
                  router.refresh();
                })
              }
            />

            {variantsOf(back.id).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {variantsOf(back.id).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setOpenId(openId === v.id ? null : v.id)}
                    title={`${back.title} – ${v.variantLabel}`}
                    className={`w-12 ${openId === v.id ? "ring-2 ring-violet-500 rounded" : ""}`}
                  >
                    <CardFacePreview
                      activeImageId={v.activeImageId}
                      widthMm={widthMm}
                      heightMm={heightMm}
                      label={v.variantLabel ?? "?"}
                    />
                    <span className="block truncate text-center text-[10px] text-zinc-500">
                      {v.variantLabel}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <form
              action={async (fd) => {
                const label = String(fd.get("label") ?? "").trim();
                if (!label) return;
                await createBackVariant(set.id, back.id, label);
                router.refresh();
              }}
              className="flex gap-1"
            >
              <input
                name="label"
                placeholder="Variant label (A, B…)"
                className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button className="rounded-md bg-violet-600 px-2 py-1 text-xs font-medium text-white hover:bg-violet-500">
                +
              </button>
            </form>
          </div>
        ))}

        <form
          action={async (fd) => {
            await createSharedBack(set.id, fd);
            router.refresh();
          }}
          className="flex w-44 flex-col justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 p-3 dark:border-zinc-700"
        >
          <input
            name="title"
            placeholder="Back name"
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500">
            + Add shared back
          </button>
        </form>
      </div>

      {open && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {open.variantLabel && (
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-500">
                Variant <strong>{open.variantLabel}</strong> of{" "}
                <strong>{openBase?.title ?? "deleted base"}</strong> — use “Alter image” to derive it
                from the base design with the new label.
              </p>
              <button
                onClick={() =>
                  startTransition(async () => {
                    await deleteSharedBack(set.id, open.id);
                    setOpenId(null);
                    router.refresh();
                  })
                }
                className="shrink-0 rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
              >
                Delete variant
              </button>
            </div>
          )}
          <FaceForm
            key={open.id}
            face={open}
            widthMm={widthMm}
            heightMm={heightMm}
            defaultReferenceImageId={openBase?.activeImageId ?? null}
            defaultAlterPrompt={
              open.variantLabel && !open.activeImageId
                ? `Change the label text to "${open.variantLabel}". Keep everything else identical.`
                : ""
            }
          />
        </div>
      )}
    </div>
  );
}

function BackTile({
  back,
  label,
  active,
  widthMm,
  heightMm,
  isDefault,
  onOpen,
  onMakeDefault,
  onDelete,
}: {
  back: FaceWithImages;
  label: string;
  active: boolean;
  widthMm: number;
  heightMm: number;
  isDefault: boolean;
  onOpen: () => void;
  onMakeDefault: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-1">
      <button onClick={onOpen} className="w-full">
        <CardFacePreview
          activeImageId={back.activeImageId}
          widthMm={widthMm}
          heightMm={heightMm}
          label={label}
          className={active ? "ring-2 ring-blue-500" : ""}
        />
      </button>
      <div className="flex items-center justify-between text-xs">
        <span className="truncate">{label}</span>
        {isDefault ? (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
            default
          </span>
        ) : (
          <button className="text-blue-600 hover:underline" onClick={onMakeDefault}>
            make default
          </button>
        )}
      </div>
      <button className="text-xs text-red-500 hover:underline" onClick={onDelete}>
        delete
      </button>
    </div>
  );
}
