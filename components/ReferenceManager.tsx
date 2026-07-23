"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteReference, renameReference } from "@/actions/references";
import { uploadReferenceImage } from "@/lib/uploads";
import { ImageLightbox } from "./ImageLightbox";
import type { ReferenceImage } from "@/lib/types";

/**
 * The set's library of uploaded pictures: upload once here, then pick the same
 * asset as a visual reference on any card front or panorama (components/FaceForm).
 * Uploads are never printed on a card.
 */
export function ReferenceManager({
  setId,
  references,
}: {
  setId: string;
  references: Pick<ReferenceImage, "id" | "name" | "widthPx" | "heightPx">[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomId, setZoomId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const zoomed = references.find((r) => r.id === zoomId) ?? null;

  async function upload(files: FileList) {
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) await uploadReferenceImage(setId, file);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      {zoomed && (
        <ImageLightbox
          src={`/api/references/${zoomed.id}`}
          alt={zoomed.name}
          widthMm={zoomed.widthPx ?? 1024}
          heightMm={zoomed.heightPx ?? 1024}
          onClose={() => setZoomId(null)}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          disabled={uploading}
          onChange={(e) => {
            const files = e.target.files;
            if (files?.length) upload(files);
          }}
          className="text-xs text-zinc-500 file:mr-2 file:rounded-md file:border file:border-zinc-300 file:bg-transparent file:px-2 file:py-1 file:text-xs file:text-zinc-700 disabled:opacity-50 dark:file:border-zinc-700 dark:file:text-zinc-200"
        />
        {uploading && <span className="text-xs text-zinc-500">Uploading…</span>}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {references.length === 0 ? (
        <p className="text-xs text-zinc-400">
          No reference pictures yet. Upload one here (or from any card&apos;s front editor) and it can
          be reused on every card front and panorama in this set.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {references.map((ref) => (
            <div
              key={ref.id}
              className="space-y-1.5 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800"
            >
              <button
                onClick={() => setZoomId(ref.id)}
                title="Click to zoom"
                className="block w-full cursor-zoom-in overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/references/${ref.id}`}
                  alt={ref.name}
                  className="aspect-square w-full object-cover"
                />
              </button>
              <form
                action={(fd) =>
                  startTransition(async () => {
                    await renameReference(ref.id, fd);
                    router.refresh();
                  })
                }
                className="flex gap-1"
              >
                <input
                  name="name"
                  defaultValue={ref.name}
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
                <button
                  title="Rename"
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  ✓
                </button>
              </form>
              <button
                onClick={() => {
                  if (!confirm(`Delete reference “${ref.name}”? Cards already generated from it stay.`))
                    return;
                  startTransition(async () => {
                    await deleteReference(ref.id);
                    if (zoomId === ref.id) setZoomId(null);
                    router.refresh();
                  });
                }}
                className="w-full rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
