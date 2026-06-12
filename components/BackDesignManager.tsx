"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSharedBack, deleteSharedBack, setDefaultBack } from "@/actions/backs";
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {sharedBacks.map((back) => (
          <div key={back.id} className="w-36 space-y-1">
            <button onClick={() => setOpenId(openId === back.id ? null : back.id)} className="w-full">
              <CardFacePreviewWithRing
                active={openId === back.id}
                activeImageId={back.activeImageId}
                widthMm={widthMm}
                heightMm={heightMm}
                label={back.title ?? "Back"}
              />
            </button>
            <div className="flex items-center justify-between text-xs">
              <span className="truncate">{back.title ?? "Back"}</span>
              {set.defaultBackId === back.id ? (
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                  default
                </span>
              ) : (
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() =>
                    startTransition(async () => {
                      await setDefaultBack(set.id, back.id);
                      router.refresh();
                    })
                  }
                >
                  make default
                </button>
              )}
            </div>
            <button
              className="text-xs text-red-500 hover:underline"
              onClick={() =>
                startTransition(async () => {
                  await deleteSharedBack(set.id, back.id);
                  if (openId === back.id) setOpenId(null);
                  router.refresh();
                })
              }
            >
              delete
            </button>
          </div>
        ))}
        <form
          action={async (fd) => {
            await createSharedBack(set.id, fd);
            router.refresh();
          }}
          className="flex w-36 flex-col justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 p-3 dark:border-zinc-700"
          style={{ aspectRatio: `${widthMm} / ${heightMm}` }}
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

      {openId &&
        (() => {
          const back = sharedBacks.find((b) => b.id === openId);
          if (!back) return null;
          return (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <FaceForm key={back.id} face={back} widthMm={widthMm} heightMm={heightMm} />
            </div>
          );
        })()}
    </div>
  );
}

function CardFacePreviewWithRing(props: {
  active: boolean;
  activeImageId: string | null;
  widthMm: number;
  heightMm: number;
  label: string;
}) {
  return (
    <CardFacePreview
      activeImageId={props.activeImageId}
      widthMm={props.widthMm}
      heightMm={props.heightMm}
      label={props.label}
      className={props.active ? "ring-2 ring-blue-500" : ""}
    />
  );
}
