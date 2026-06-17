"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createItem, reorderItems } from "@/actions/items";
import { CardFacePreview } from "./CardFacePreview";
import type { Card } from "@/lib/types";

const inputCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type ItemCard = Card & { front: { activeImageId: string | null } };

export function ItemManager({
  setId,
  items,
  widthMm,
  heightMm,
}: {
  setId: string;
  items: ItemCard[];
  widthMm: number;
  heightMm: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const ordered = [...items].sort(
    (a, b) => (a.number ?? 0) - (b.number ?? 0) || a.orderIndex - b.orderIndex,
  );

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    const ids = ordered.map((c) => c.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    startTransition(async () => {
      await reorderItems(setId, ids);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {ordered.map((item, i) => (
          <div key={item.id} className="group space-y-1.5">
            <Link href={`/sets/${setId}/cards/${item.id}`} className="relative block">
              <CardFacePreview
                activeImageId={item.front.activeImageId}
                widthMm={widthMm}
                heightMm={heightMm}
                label={item.name}
                className="ring-1 ring-transparent group-hover:ring-blue-400"
              />
              <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-xs font-bold text-white">
                {item.number ?? "?"}
              </span>
            </Link>
            <div className="flex items-center gap-1 text-xs">
              <span className="truncate text-zinc-500">{item.name}</span>
              <span className="ml-auto flex gap-0.5">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded border px-1 disabled:opacity-30 dark:border-zinc-700"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === ordered.length - 1}
                  className="rounded border px-1 disabled:opacity-30 dark:border-zinc-700"
                >
                  ↓
                </button>
              </span>
            </div>
          </div>
        ))}
        <form
          action={createItem.bind(null, setId)}
          className="flex flex-col justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 p-3 dark:border-zinc-700"
          style={{ aspectRatio: `${widthMm} / ${heightMm}` }}
        >
          <input name="name" placeholder="Item name" required className={`${inputCls} w-full text-xs`} />
          <button className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500">
            + Add item
          </button>
        </form>
      </div>
    </div>
  );
}
