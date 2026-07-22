"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Mirrors ExportJobView in lib/pdf/job. */
type JobView = {
  id: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "NONE";
  phase?: string;
  done?: number;
  total?: number;
  bytes?: number | null;
  error?: string | null;
};

const POLL_MS = 1000;

const PHASE_LABEL: Record<string, string> = {
  images: "Rendering images",
  embed: "Embedding images",
  pages: "Laying out pages",
  saving: "Writing PDF",
};

/**
 * Exports run as a background job (lib/pdf/job): the POST returns immediately
 * and this polls the job row until the PDF is on disk. Attaches to an export
 * already in flight, so a reload mid-export keeps showing its progress.
 */
export function ExportPdfButton({ setId }: { setId: string }) {
  const [job, setJob] = useState<JobView | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The finished job whose download has already been offered — a completed
  // export must not re-download itself on every render or reload.
  const downloadedRef = useRef<string | null>(null);

  const running = starting || job?.status === "PENDING" || job?.status === "RUNNING";

  // Pick up an export already running (or the last finished one) on mount.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sets/${setId}/pdf`)
      .then((res) => res.json())
      .then((data: JobView) => {
        if (cancelled || data.status === "NONE") return;
        // A job that finished before this page loaded is not ours to auto-download.
        if (data.status === "DONE") downloadedRef.current = data.id;
        setJob(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setId]);

  useEffect(() => {
    if (!job || (job.status !== "PENDING" && job.status !== "RUNNING")) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/exports/${job.id}`);
        if (!res.ok) return;
        setJob(await res.json());
      } catch {
        // A dropped poll is harmless — the next tick retries.
      }
    }, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [job]);

  // Hand the finished PDF over once, without navigating away from the set.
  useEffect(() => {
    if (job?.status !== "DONE" || downloadedRef.current === job.id) return;
    downloadedRef.current = job.id;
    const a = document.createElement("a");
    a.href = `/api/exports/${job.id}/download`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [job]);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      const res = await fetch(`/api/sets/${setId}/pdf`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the export");
      setJob({ id: data.jobId, status: "PENDING", phase: "images", done: 0, total: 0 });
    } catch (err) {
      setJob({
        id: "",
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setStarting(false);
    }
  }, [setId]);

  const total = job?.total ?? 0;
  const done = job?.done ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={start}
        disabled={running}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {running ? "Exporting…" : "Export PDF"}
      </button>

      {running && (
        <div className="w-44 space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className={`h-full bg-emerald-500 transition-[width] ${pct === null ? "w-1/3 animate-pulse" : ""}`}
              style={pct === null ? undefined : { width: `${pct}%` }}
            />
          </div>
          <p className="text-right text-[11px] text-zinc-400">
            {PHASE_LABEL[job?.phase ?? ""] ?? "Starting"}
            {total > 0 ? ` ${done}/${total}` : "…"}
          </p>
        </div>
      )}

      {job?.status === "DONE" && (
        <a
          href={`/api/exports/${job.id}/download`}
          className="text-[11px] text-emerald-600 hover:underline"
        >
          Download again
          {job.bytes ? ` (${Math.round(job.bytes / 1_000_000)} MB)` : ""}
        </a>
      )}

      {job?.status === "FAILED" && (
        <p className="max-w-56 text-right text-[11px] text-red-600">
          {job.error ?? "Export failed"}
        </p>
      )}
    </div>
  );
}
