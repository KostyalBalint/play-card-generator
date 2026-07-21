"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setCardLabelOverlay,
  setFaceLabelOverlay,
  setInPanorama,
  updateLocationCard,
} from "@/actions/locations";
import { createCustomBack, duplicateAsCustomBack, switchCardBack } from "@/actions/backs";
import { overlayFor } from "@/lib/overlay";
import { FaceForm } from "./FaceForm";
import type { Card, CardSet, FaceWithImages } from "@/lib/types";

const inputCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type CardWithFaces = Card & { front: FaceWithImages; back: FaceWithImages | null };

export function CardFaceModal({
  set,
  card,
  sharedBacks,
  locationName,
  widthMm,
  heightMm,
  onClose,
}: {
  set: CardSet;
  card: CardWithFaces;
  /** The set's pack-level shared backs, selectable as a non-panorama card's back. */
  sharedBacks: FaceWithImages[];
  /** Default caption for the card's back overlay. */
  locationName: string;
  widthMm: number;
  heightMm: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<"front" | "back">("front");

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  // Esc to close + lock background scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Effective back: explicit per-card face, else the set's default shared back.
  const effectiveBack =
    card.back ?? sharedBacks.find((b) => b.id === set.defaultBackId) ?? null;
  const backIsCustom = card.back != null && card.back.sharedBackSetId === null;
  const backIsShared = effectiveBack != null && effectiveBack.sharedBackSetId !== null;
  const usingDefault = card.backFaceId === null;
  const overlay = overlayFor(card, effectiveBack, locationName);

  function chooseBack(value: string) {
    run(async () => {
      if (value === "__default") await switchCardBack(card.id, null);
      else if (value === "__custom") {
        if (effectiveBack) await duplicateAsCustomBack(card.id, effectiveBack.id);
        else await createCustomBack(card.id);
      } else await switchCardBack(card.id, value);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h2 className="flex items-center gap-2 font-semibold">
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-sm font-bold dark:bg-zinc-800">
              {card.positionLabel ?? "?"}
            </span>
            {card.name}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Per-card meta — organisation & printing, not drawn on the artwork */}
          <form
            action={(fd) => run(() => updateLocationCard(card.id, fd))}
            className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Card details</h3>
                <p className="text-xs text-zinc-400">
                  How the card is organised &amp; printed. Not drawn on the artwork — the on-image text
                  lives in the Front/Back editor below.
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={card.inPanorama}
                  onChange={(e) => run(() => setInPanorama(card.id, e.target.checked))}
                  className="h-4 w-4"
                />
                Panorama member
              </label>
            </div>
            <div className="flex flex-wrap items-start gap-3">
              <Field label="Card name" hint="internal — lists & PDF only">
                <input name="name" defaultValue={card.name} className={`${inputCls} block w-44`} />
              </Field>
              <Field label="Position" hint="panorama order & back letter">
                <input
                  name="positionLabel"
                  defaultValue={card.positionLabel ?? ""}
                  className={`${inputCls} block w-20`}
                />
              </Field>
              <Field label="Back text" hint="shown on the back instead of the letter">
                <input
                  name="backText"
                  defaultValue={card.backText ?? ""}
                  placeholder={card.positionLabel ?? "e.g. No entry"}
                  className={`${inputCls} block w-44`}
                />
              </Field>
              {set.showNumbers && (
                <Field label="Number" hint="badge on the card">
                  <input
                    name="number"
                    type="number"
                    defaultValue={card.number ?? ""}
                    className={`${inputCls} block w-20`}
                  />
                </Field>
              )}
              <Field label="Copies" hint="duplicates in the PDF">
                <input
                  name="copies"
                  type="number"
                  min={1}
                  defaultValue={card.copies}
                  className={`${inputCls} block w-20`}
                />
              </Field>
              <div className="self-end">
                <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
                  Save card details
                </button>
              </div>
            </div>
          </form>

          {/* Front / Back tabs */}
          <div className="mb-1 flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800">
            {(["front", "back"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium capitalize ${
                  tab === t ? "bg-white shadow dark:bg-zinc-700" : "text-zinc-500"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <p className="text-xs text-zinc-400">
            {tab === "front"
              ? "The artwork on the front. “Title” is drawn onto the image; “Save” stores the text/prompt, the buttons regenerate the picture."
              : "The artwork on the back. Turn on the label overlay to draw the position letter / back text over it — no need to bake it in."}
          </p>

          {/* Non-panorama: pick the back from the pack's shared backs (or a custom copy). */}
          {tab === "back" && !card.inPanorama && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs font-medium text-zinc-500">Back source:</span>
              <select
                className={inputCls}
                value={usingDefault ? "__default" : backIsCustom ? "__custom" : card.backFaceId ?? "__default"}
                onChange={(e) => chooseBack(e.target.value)}
              >
                <option value="__default">Set default back</option>
                {sharedBacks.map((b) => {
                  const base = b.basedOnFaceId ? sharedBacks.find((s) => s.id === b.basedOnFaceId) : null;
                  const label = b.variantLabel
                    ? `${base?.title ?? b.title ?? "Back"} – ${b.variantLabel}`
                    : b.title ?? b.id.slice(0, 6);
                  return (
                    <option key={b.id} value={b.id}>
                      Shared: {label}
                    </option>
                  );
                })}
                <option value="__custom">
                  {backIsCustom ? "Custom back (this card only)" : "Customize for this card…"}
                </option>
              </select>
            </div>
          )}

          {/* Card-driven overlay — works with any back, incl. the set's shared default.
              Meant for the establishing card (A), which sits outside the panorama. */}
          {tab === "back" && !card.inPanorama && (
            <div className="space-y-2 rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={card.labelOverlay}
                  onChange={(e) => run(() => setCardLabelOverlay(card.id, e.target.checked))}
                  className="h-4 w-4"
                />
                <span>
                  Draw text over the back
                  <span className="ml-1 text-xs text-zinc-400">
                    (“{card.backText?.trim() || card.positionLabel || "?"}” +{" "}
                    “{card.overlayCaption?.trim() || locationName}” — rendered text, no image
                    generation)
                  </span>
                </span>
              </label>
              {card.labelOverlay && (
                <form
                  action={(fd) => run(() => updateLocationCard(card.id, fd))}
                  className="flex items-end gap-2"
                >
                  <label className="text-xs font-medium text-zinc-500">
                    <span className="block">Caption</span>
                    <input
                      name="overlayCaption"
                      defaultValue={card.overlayCaption ?? ""}
                      placeholder={locationName}
                      className={`${inputCls} block w-64`}
                    />
                  </label>
                  <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                    Save caption
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Face-driven overlay — only for an editable own face (custom back or panorama slice). */}
          {tab === "back" && card.back && card.back.sharedBackSetId === null && (
            <label className="flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
              <input
                type="checkbox"
                checked={!!card.back.labelOverlay}
                onChange={(e) => run(() => setFaceLabelOverlay(card.back!.id, e.target.checked))}
                className="h-4 w-4"
              />
              <span>
                Show label overlay
                <span className="ml-1 text-xs text-zinc-400">
                  (draws “{card.backText?.trim() || card.positionLabel || "?"}” along the bottom of the
                  image — preview &amp; PDF)
                </span>
              </span>
            </label>
          )}

          {tab === "front" ? (
            <FaceForm
              key={`front-${card.front.id}`}
              face={card.front}
              widthMm={widthMm}
              heightMm={heightMm}
              backReferenceImageId={effectiveBack?.activeImageId ?? null}
              saveLabel="Save text & prompt"
            />
          ) : card.inPanorama ? (
            card.back?.activeImageId ? (
              <FaceForm
                key={`back-${card.back.id}`}
                face={card.back}
                widthMm={widthMm}
                heightMm={heightMm}
                overlay={overlay}
                saveLabel="Save text & prompt"
              />
            ) : (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Panorama member — generate the panorama and click “Split to cards” to fill this back. The
                position letter is then drawn as an overlay automatically (no extra generation).
              </p>
            )
          ) : effectiveBack ? (
            <FaceForm
              key={`back-${effectiveBack.id}`}
              face={effectiveBack}
              widthMm={widthMm}
              heightMm={heightMm}
              readOnly={!backIsCustom}
              readOnlyNote={
                backIsShared
                  ? usingDefault
                    ? "The set's default back, shared by other cards. Edit it on the set page, or choose “Customize for this card”."
                    : "A shared back used by other cards. Edit it on the set page, or choose “Customize for this card”."
                  : undefined
              }
              overlay={overlay}
              saveLabel="Save text & prompt"
            />
          ) : (
            <p className="text-sm text-zinc-400">
              No back yet — pick a shared back above, “Customize for this card”, or add a shared back on the
              set page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Labelled input with a small clarifying hint underneath. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs font-medium text-zinc-500">
      <span className="block">{label}</span>
      {children}
      <span className="mt-0.5 block text-[10px] font-normal text-zinc-400">{hint}</span>
    </label>
  );
}
