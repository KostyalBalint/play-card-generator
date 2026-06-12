"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFace, setActiveImage } from "@/actions/cards";
import { CardFacePreview } from "./CardFacePreview";
import { ImageLightbox } from "./ImageLightbox";
import type { FaceDraft, FaceWithImages } from "@/lib/types";
import { draftFromFace } from "@/lib/types";

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const labelCls = "block text-xs font-medium text-zinc-500 dark:text-zinc-400";

export function FaceForm({
  face,
  widthMm,
  heightMm,
  readOnly = false,
  readOnlyNote,
  draft: controlledDraft,
  onDraftChange,
}: {
  face: FaceWithImages;
  widthMm: number;
  heightMm: number;
  readOnly?: boolean;
  readOnlyNote?: string;
  draft?: FaceDraft;
  onDraftChange?: (draft: FaceDraft) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [internalDraft, setInternalDraft] = useState<FaceDraft>(() => draftFromFace(face));
  const [lightboxOpen, setLightboxOpen] = useState(false);
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

  async function generate() {
    setGenError(null);
    setGenerating(true);
    try {
      await updateFace(face.id, draft);
      const res = await fetch(`/api/faces/${face.id}/generate`, { method: "POST" });
      const data = await res.json();
      if (data.status === "FAILED") setGenError(data.error ?? "Generation failed");
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
      router.refresh();
    }
  }

  const doneImages = face.images.filter((img) => img.status === "DONE");

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
      {lightboxOpen && face.activeImageId && (
        <ImageLightbox
          src={`/api/images/${face.activeImageId}`}
          alt={draft.title || "Card face"}
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
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={isPending || generating}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Save
            </button>
            <button
              onClick={generate}
              disabled={generating || !draft.imagePrompt.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {generating ? "Generating…" : face.activeImageId ? "Regenerate image" : "Generate image"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
