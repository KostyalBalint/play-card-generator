"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOverlayStyle } from "@/actions/backs";
import { CardFacePreview } from "./CardFacePreview";
import {
  DEFAULT_OVERLAY_STYLE,
  FONT_CATALOG,
  OVERLAY_FONTS,
  parseOverlayStyle,
  type OverlayAnchor,
  type OverlayStyle,
  type OverlayTextStyle,
} from "@/lib/overlaystyle";
import type { FaceWithImages } from "@/lib/types";

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900";
const labelCls = "block text-[11px] font-medium text-zinc-500 dark:text-zinc-400";

const ANCHOR_GRID: OverlayAnchor[][] = [
  ["top-left", "top", "top-right"],
  ["left", "center", "right"],
  ["bottom-left", "bottom", "bottom-right"],
];

/**
 * Edits how the rendered (not baked) overlay sits on THIS face — the arrangement
 * every card using this back inherits. Preview is live; Save persists to
 * CardFace.overlayStyle (see lib/overlaystyle).
 */
export function OverlayStyleEditor({
  face,
  widthMm,
  heightMm,
  sampleLabel = "12",
  sampleCaption = "Caption",
}: {
  face: FaceWithImages;
  widthMm: number;
  heightMm: number;
  /** Stand-in texts for the preview — the real text comes from the card. */
  sampleLabel?: string;
  sampleCaption?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [style, setStyle] = useState<OverlayStyle>(() => parseOverlayStyle(face.overlayStyle));

  function patch(slot: keyof OverlayStyle, changes: Partial<OverlayTextStyle>) {
    setStyle({ ...style, [slot]: { ...style[slot], ...changes } });
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
      <div className="space-y-2">
        <CardFacePreview
          activeImageId={face.activeImageId}
          widthMm={widthMm}
          heightMm={heightMm}
          label={face.title ?? "Back"}
          overlay={{ label: sampleLabel, caption: sampleCaption }}
          overlayStyle={style}
        />
        <div className="flex gap-2">
          <button
            onClick={() =>
              startTransition(async () => {
                await updateOverlayStyle(face.id, style);
                router.refresh();
              })
            }
            disabled={isPending}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save text style"}
          </button>
          <button
            onClick={() => setStyle(DEFAULT_OVERLAY_STYLE)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Reset
          </button>
        </div>
        <p className="text-[11px] text-zinc-400">
          Sample text only — each card supplies its own (item number, position letter, location name).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SlotControls
          title="Big label"
          hint="Item number, position letter"
          style={style.label}
          onChange={(c) => patch("label", c)}
        />
        <SlotControls
          title="Small caption"
          hint="Location name, panorama letter"
          style={style.caption}
          onChange={(c) => patch("caption", c)}
        />
      </div>
    </div>
  );
}

function SlotControls({
  title,
  hint,
  style,
  onChange,
}: {
  title: string;
  hint: string;
  style: OverlayTextStyle;
  onChange: (changes: Partial<OverlayTextStyle>) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div>
        <h4 className="text-xs font-semibold">{title}</h4>
        <p className="text-[11px] text-zinc-400">{hint}</p>
      </div>

      <div>
        <span className={labelCls}>Position</span>
        <div className="mt-1 grid w-fit grid-cols-3 gap-0.5">
          {ANCHOR_GRID.flat().map((a) => (
            <button
              key={a}
              title={a}
              onClick={() => onChange({ anchor: a })}
              className={`h-6 w-6 rounded border text-[10px] ${
                style.anchor === a
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              ●
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={labelCls}>Nudge X ({style.offsetXPct}%)</span>
          <input
            type="range"
            min={-50}
            max={50}
            step={1}
            value={style.offsetXPct}
            onChange={(e) => onChange({ offsetXPct: Number(e.target.value) })}
            className="w-full"
          />
        </label>
        <label className="block">
          <span className={labelCls}>Nudge Y ({style.offsetYPct}%)</span>
          <input
            type="range"
            min={-50}
            max={50}
            step={1}
            value={style.offsetYPct}
            onChange={(e) => onChange({ offsetYPct: Number(e.target.value) })}
            className="w-full"
          />
        </label>
      </div>

      <label className="block">
        <span className={labelCls}>Size ({style.sizePct}% of card height)</span>
        <input
          type="range"
          min={1}
          max={40}
          step={0.5}
          value={style.sizePct}
          onChange={(e) => onChange({ sizePct: Number(e.target.value) })}
          className="w-full"
        />
      </label>

      <label className="block">
        <span className={labelCls}>Font</span>
        <select
          className={inputCls}
          value={style.font}
          style={{ fontFamily: FONT_CATALOG[style.font].css }}
          onChange={(e) => onChange({ font: e.target.value as OverlayTextStyle["font"] })}
        >
          {OVERLAY_FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: FONT_CATALOG[f].css }}>
              {FONT_CATALOG[f].label}
            </option>
          ))}
        </select>
        {!FONT_CATALOG[style.font].files.bold && (
          <span className="mt-0.5 block text-[11px] text-zinc-400">
            This family has one weight — Bold has no effect.
          </span>
        )}
      </label>

      <div className="flex items-end gap-3">
        <label className="block">
          <span className={labelCls}>Text</span>
          <input
            type="color"
            value={style.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-7 w-14 rounded border border-zinc-300 bg-white dark:border-zinc-700"
          />
        </label>
        <label className="block flex-1">
          <span className={labelCls}>Text opacity ({style.textOpacity}%)</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={style.textOpacity}
            onChange={(e) => onChange({ textOpacity: Number(e.target.value) })}
            className="w-full"
          />
        </label>
        <label className="flex items-center gap-1.5 pb-1 text-xs">
          <input
            type="checkbox"
            checked={style.bold}
            onChange={(e) => onChange({ bold: e.target.checked })}
            className="h-4 w-4"
          />
          Bold
        </label>
      </div>

      <div className="flex items-end gap-3">
        <label className="block">
          <span className={labelCls}>Plate</span>
          <input
            type="color"
            value={style.plateColor}
            onChange={(e) => onChange({ plateColor: e.target.value })}
            className="h-7 w-14 rounded border border-zinc-300 bg-white dark:border-zinc-700"
          />
        </label>
        <label className="block flex-1">
          <span className={labelCls}>
            Plate opacity ({style.plateOpacity}%{style.plateOpacity === 0 ? " — no plate" : ""})
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={style.plateOpacity}
            onChange={(e) => onChange({ plateOpacity: Number(e.target.value) })}
            className="w-full"
          />
        </label>
      </div>
    </div>
  );
}
