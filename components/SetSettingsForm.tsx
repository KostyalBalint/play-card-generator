"use client";

import { useState } from "react";
import { updateSet } from "@/actions/sets";
import { computeGrid } from "@/lib/pdf/grid";
import { SIZE_PRESETS } from "@/lib/sizes";
import type { CardSet } from "@/lib/types";

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const labelCls = "block text-xs font-medium text-zinc-500 dark:text-zinc-400";

export function SetSettingsForm({ set }: { set: CardSet }) {
  const [preset, setPreset] = useState(set.sizePreset);
  const [width, setWidth] = useState(set.widthMm);
  const [height, setHeight] = useState(set.heightMm);
  const [fitToPage, setFitToPage] = useState(set.fitToPage);

  // What the chosen size actually prints as — the grid is what decides it, so
  // ask the same code the PDF does (lib/pdf/grid).
  const nominal = preset === "CUSTOM" ? { widthMm: width, heightMm: height } : SIZE_PRESETS[preset];
  const grid = computeGrid(nominal.widthMm, nominal.heightMm, fitToPage);
  const printed = `${grid.cardWidthMm.toFixed(1)} × ${grid.cardHeightMm.toFixed(1)} mm`;

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
            <option value="IMAGE_2_3">Image native 2:3 (70 × 105 mm)</option>
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
                value={width}
                onChange={(e) => setWidth(Number(e.target.value) || 0)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Height (mm)</label>
              <input
                name="heightMm"
                type="number"
                step="0.1"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value) || 0)}
                className={inputCls}
              />
            </div>
          </>
        )}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="fitToPage"
          checked={fitToPage}
          onChange={(e) => setFitToPage(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300"
        />
        <span>
          Fit to page — print the cards as large as the sheet allows
          <span className="mt-0.5 block text-xs text-zinc-400">
            Same {grid.perPage} per A4 sheet ({grid.cols} × {grid.rows}) and the same aspect, only
            bigger. Prints at <strong>{printed}</strong>. Generated art is never upscaled, so the
            bigger card spreads the same pixels wider — around 250 dpi instead of 300.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="exportIndex"
          defaultChecked={set.exportIndex}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300"
        />
        <span>
          Number the cards at export
          <span className="mt-0.5 block text-xs text-zinc-400">
            Small running index in the bottom-right corner of each card back, counted in print
            order: maps, then items, then each location A → N. Copies of a card share its number.
          </span>
        </span>
      </label>
      <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
        Save settings
      </button>
    </form>
  );
}
