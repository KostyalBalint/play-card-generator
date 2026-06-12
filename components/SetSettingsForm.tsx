"use client";

import { useState } from "react";
import { updateSet } from "@/actions/sets";
import type { CardSet } from "@/lib/types";

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const labelCls = "block text-xs font-medium text-zinc-500 dark:text-zinc-400";

export function SetSettingsForm({ set }: { set: CardSet }) {
  const [preset, setPreset] = useState(set.sizePreset);

  return (
    <form action={(fd) => updateSet(set.id, fd)} className="space-y-3">
      <div>
        <label className={labelCls}>Name</label>
        <input name="name" defaultValue={set.name} required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <input name="description" defaultValue={set.description ?? ""} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>
          Style prompt — prepended to every image generation in this set
        </label>
        <textarea name="stylePrompt" defaultValue={set.stylePrompt} rows={3} className={inputCls} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="showNumbers"
          defaultChecked={set.showNumbers}
          className="h-4 w-4 rounded border-zinc-300"
        />
        Number the cards (shows a number badge on card images)
      </label>
      <div className="flex gap-3">
        <div>
          <label className={labelCls}>Card size</label>
          <select
            name="sizePreset"
            value={preset}
            onChange={(e) => setPreset(e.target.value as CardSet["sizePreset"])}
            className={inputCls}
          >
            <option value="TAROT">Tarot (70 × 120 mm)</option>
            <option value="POKER">Poker (63.5 × 88.9 mm)</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </div>
        {preset === "CUSTOM" && (
          <>
            <div>
              <label className={labelCls}>Width (mm)</label>
              <input
                name="widthMm"
                type="number"
                step="0.1"
                defaultValue={set.widthMm}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Height (mm)</label>
              <input
                name="heightMm"
                type="number"
                step="0.1"
                defaultValue={set.heightMm}
                className={inputCls}
              />
            </div>
          </>
        )}
      </div>
      <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
        Save settings
      </button>
    </form>
  );
}
