"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFace, setActiveImage } from "@/actions/cards";
import { CardFacePreview } from "./CardFacePreview";
import { ImageLightbox } from "./ImageLightbox";
import type { FaceOverlay } from "@/lib/overlay";
import type { FaceDraft, FaceWithImages } from "@/lib/types";
import { draftFromFace } from "@/lib/types";

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const labelCls = "block text-xs font-medium text-zinc-500 dark:text-zinc-400";

/** A card whose front art can seed another face's generation. */
export type ReferenceCard = { id: string; label: string; imageId: string };

export function FaceForm({
  face,
  widthMm,
  heightMm,
  readOnly = false,
  readOnlyNote,
  draft: controlledDraft,
  onDraftChange,
  defaultReferenceImageId = null,
  defaultAlterPrompt = "",
  backReferenceImageId = null,
  referenceCards = [],
  overlay = null,
  saveLabel = "Save",
}: {
  face: FaceWithImages;
  widthMm: number;
  heightMm: number;
  readOnly?: boolean;
  readOnlyNote?: string;
  draft?: FaceDraft;
  onDraftChange?: (draft: FaceDraft) => void;
  /** Fallback reference for alter-mode when this face has no image yet (e.g. fresh back variant) */
  defaultReferenceImageId?: string | null;
  defaultAlterPrompt?: string;
  /** Card's back active image — enables "match back side" on a front face's main Generate. */
  backReferenceImageId?: string | null;
  /** Other cards whose front art can be used as a reference — same flow as "match back side". */
  referenceCards?: ReferenceCard[];
  /** Rendered (not baked) label + caption drawn over the preview — see lib/overlay. */
  overlay?: FaceOverlay | null;
  /** Label for the plain (no-regen) save button. */
  saveLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [internalDraft, setInternalDraft] = useState<FaceDraft>(() => draftFromFace(face));
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [alterPrompt, setAlterPrompt] = useState(defaultAlterPrompt);
  const [matchBack, setMatchBack] = useState(false);
  const [refCardId, setRefCardId] = useState("");
  const draft = controlledDraft ?? internalDraft;
  const setDraft = onDraftChange ?? setInternalDraft;

  const latest = face.images[0];
  const [generating, setGenerating] = useState(latest?.status === "PENDING");
  const [genError, setGenError] = useState<string | null>(
    latest?.status === "FAILED" ? latest.error : null,
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recover from a page refresh mid-generation: poll until the latest image resolves.
  useEffect(() => {
    if (!generating) return;
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/faces/${face.id}/generate`);
      const data = await res.json();
      if (data.status === "DONE" || data.status === "FAILED") {
        setGenerating(false);
        if (data.status === "FAILED") setGenError(data.error ?? "Generation failed");
        router.refresh();
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [generating, face.id, router]);

  function set<K extends keyof FaceDraft>(key: K, value: FaceDraft[K]) {
    setDraft({ ...draft, [key]: value });
  }

  function save() {
    startTransition(async () => {
      await updateFace(face.id, draft);
      router.refresh();
    });
  }

  async function generate(opts?: {
    referenceImageId?: string;
    useFacePrompt?: boolean;
    alterText?: boolean;
    referenceKind?: "back" | "card";
  }) {
    setGenError(null);
    setGenerating(true);
    try {
      await updateFace(face.id, draft);
      const referenceImageId = opts?.referenceImageId;
      const res = await fetch(`/api/faces/${face.id}/generate`, {
        method: "POST",
        ...(referenceImageId
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                opts?.alterText
                  ? { referenceImageId, alterText: true }
                  : opts?.useFacePrompt
                    ? { referenceImageId, useFacePrompt: true, referenceKind: opts.referenceKind ?? "back" }
                    : { referenceImageId, alterPrompt },
              ),
            }
          : {}),
      });
      const data = await res.json();
      if (data.status === "FAILED") setGenError(data.error ?? "Generation failed");
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
      router.refresh();
    }
  }

  const refImageId = face.activeImageId ?? defaultReferenceImageId;

  const doneImages = face.images.filter((img) => img.status === "DONE");

  // Reference for the main Generate: a picked card's front wins over the card's
  // own back — both take the same "own prompt + reference image" path.
  const refCard = referenceCards.find((c) => c.id === refCardId) ?? null;
  const genRef = refCard
    ? { referenceImageId: refCard.imageId, useFacePrompt: true, referenceKind: "card" as const }
    : matchBack && backReferenceImageId
      ? { referenceImageId: backReferenceImageId, useFacePrompt: true, referenceKind: "back" as const }
      : undefined;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
      {lightboxOpen && face.activeImageId && (
        <ImageLightbox
          src={`/api/images/${face.activeImageId}`}
          alt={draft.title || "Card face"}
          widthMm={widthMm}
          heightMm={heightMm}
          overlay={overlay}
          onClose={() => setLightboxOpen(false)}
        />
      )}
      <div className="space-y-3">
        <div
          className={`relative ${face.activeImageId ? "cursor-zoom-in" : ""}`}
          onClick={() => face.activeImageId && setLightboxOpen(true)}
          title={face.activeImageId ? "Click to zoom" : undefined}
        >
          <CardFacePreview
            activeImageId={face.activeImageId}
            widthMm={widthMm}
            heightMm={heightMm}
            label={draft.title || "No image yet"}
            overlay={overlay}
          />
          {generating && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
        </div>
        {doneImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {doneImages.map((img) => (
              <button
                key={img.id}
                title={new Date(img.createdAt).toLocaleString()}
                onClick={() =>
                  startTransition(async () => {
                    await setActiveImage(face.id, img.id);
                    router.refresh();
                  })
                }
                className={`h-16 w-12 shrink-0 overflow-hidden rounded border-2 ${
                  img.id === face.activeImageId ? "border-blue-500" : "border-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/images/${img.id}`} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {readOnly && readOnlyNote && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {readOnlyNote}
          </p>
        )}
        <div>
          <label className={labelCls}>Text layout</label>
          <select
            className={inputCls}
            value={draft.textLayout}
            disabled={readOnly}
            onChange={(e) => set("textLayout", e.target.value as FaceDraft["textLayout"])}
          >
            <option value="NONE">No text</option>
            <option value="TITLE_BANNER">Title banner</option>
            <option value="TEXT_BOX">Title + text box</option>
          </select>
        </div>
        {draft.textLayout !== "NONE" && (
          <div>
            <label className={labelCls}>Title (rendered on the image)</label>
            <input
              className={inputCls}
              value={draft.title}
              disabled={readOnly}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
        )}
        {draft.textLayout === "TEXT_BOX" && (
          <div>
            <label className={labelCls}>Body text (keep short — rendered on the image)</label>
            <textarea
              className={inputCls}
              rows={3}
              value={draft.bodyText}
              disabled={readOnly}
              onChange={(e) => set("bodyText", e.target.value)}
            />
          </div>
        )}
        <div>
          <label className={labelCls}>Image prompt (scene only — set style is added automatically)</label>
          <textarea
            className={inputCls}
            rows={4}
            value={draft.imagePrompt}
            disabled={readOnly}
            onChange={(e) => set("imagePrompt", e.target.value)}
          />
        </div>
        {genError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            {genError}
          </p>
        )}
        {!readOnly && (
          <div className="space-y-2">
            {backReferenceImageId && (
              <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={matchBack}
                  onChange={(e) => setMatchBack(e.target.checked)}
                  className="h-4 w-4"
                />
                Match back side — use the card&apos;s back image as a visual reference (same character/scene/style)
              </label>
            )}
            {referenceCards.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="flex-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Reference card — generate from this face&apos;s prompt with another card&apos;s art as a
                  visual reference (style, palette, world)
                  <select
                    className={`${inputCls} mt-1`}
                    value={refCardId}
                    onChange={(e) => setRefCardId(e.target.value)}
                  >
                    <option value="">No reference card</option>
                    {referenceCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                {refCard && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/images/${refCard.imageId}`}
                    alt={refCard.label}
                    className="h-16 w-12 shrink-0 self-end rounded border border-zinc-300 object-cover dark:border-zinc-700"
                  />
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={isPending || generating}
                title="Save the text & prompt below without regenerating the image"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {saveLabel}
              </button>
              <button
                onClick={() => generate(genRef)}
                disabled={generating || !draft.imagePrompt.trim()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {generating
                  ? "Generating…"
                  : `${face.activeImageId ? "Regenerate" : "Generate"} ${
                      refCard ? "from card" : genRef ? "from back" : "image"
                    }`}
              </button>
              {face.activeImageId && (
                <button
                  onClick={() => generate({ referenceImageId: face.activeImageId!, alterText: true })}
                  disabled={
                    generating ||
                    (draft.textLayout !== "NONE" && !draft.title.trim() && !draft.bodyText.trim())
                  }
                  title="Bake the title/body text onto the current image without redrawing the artwork"
                  className="rounded-md border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
                >
                  Alter title/body
                </button>
              )}
            </div>
          </div>
        )}
        {!readOnly && refImageId && (
          <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950">
            <label className={labelCls}>
              Alter image — describe the change; {face.activeImageId ? "the current image" : "the base design"}{" "}
              is used as reference, style stays the same
            </label>
            <textarea
              className={inputCls}
              rows={2}
              value={alterPrompt}
              placeholder={'e.g. Change the label text to "B". Keep everything else identical.'}
              onChange={(e) => setAlterPrompt(e.target.value)}
            />
            <button
              onClick={() => generate({ referenceImageId: refImageId ?? undefined })}
              disabled={generating || !alterPrompt.trim()}
              className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {generating ? "Generating…" : "Alter image"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
