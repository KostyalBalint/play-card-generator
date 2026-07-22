import { prisma } from "@/lib/prisma";
import { deleteStorageFile, writeStorageFile } from "@/lib/storage";
import { exportSetPdf, type ExportProgress } from "./export";
import type { ExportJob } from "@/lib/generated/prisma/client";

/**
 * A big set takes minutes to export, so the browser cannot wait on the request.
 * The POST creates a row here and the work runs in-process afterwards (`after()`
 * in the route); the row is the whole progress channel the client polls.
 */

/**
 * A running job that has not touched its row for this long is assumed dead —
 * the server was restarted or the process crashed mid-export. Nothing can
 * revive it, so it reads as failed instead of spinning forever. Comfortably
 * longer than the slowest single step (one image render).
 */
const STALE_MS = 5 * 60_000;

/** At most one row update per this long — a 60-face set must not be 60 writes. */
const PROGRESS_INTERVAL_MS = 500;

export type ExportJobView = {
  id: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  phase: string;
  done: number;
  total: number;
  bytes: number | null;
  error: string | null;
};

const exportPath = (setId: string, jobId: string) => `exports/${setId}/${jobId}.pdf`;

/** Download name for a set's PDF — the set name, stripped to a safe filename. */
export const exportFilename = (setName: string) =>
  `${setName.replace(/[^a-z0-9-_]+/gi, "_")}.pdf`;

/** True while the job is (or should be) making progress. */
function isLive(job: ExportJob): boolean {
  if (job.status !== "PENDING" && job.status !== "RUNNING") return false;
  return Date.now() - job.updatedAt.getTime() < STALE_MS;
}

/** The row as the API reports it, with a stalled job surfaced as a failure. */
export function jobView(job: ExportJob): ExportJobView {
  const dead = (job.status === "PENDING" || job.status === "RUNNING") && !isLive(job);
  return {
    id: job.id,
    status: dead ? "FAILED" : job.status,
    phase: job.phase,
    done: job.done,
    total: job.total,
    bytes: job.bytes,
    error: dead ? "Export stopped — the server restarted mid-export. Try again." : job.error,
  };
}

/**
 * The job to poll for a set: an in-flight one, else the newest finished one so
 * a reload after the export still offers the download.
 */
export async function latestExportJob(setId: string): Promise<ExportJob | null> {
  return prisma.exportJob.findFirst({ where: { setId }, orderBy: { createdAt: "desc" } });
}

/**
 * Start an export, or join the one already running. Two concurrent exports of
 * the same set would double the peak memory for an identical file, so an
 * in-flight job wins over a new one.
 */
export async function startExportJob(setId: string): Promise<string> {
  const running = await prisma.exportJob.findFirst({
    where: { setId, status: { in: ["PENDING", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
  });
  if (running && isLive(running)) return running.id;
  const job = await prisma.exportJob.create({ data: { setId } });
  return job.id;
}

/** Drop every earlier job of this set, files included — only the newest is kept. */
async function forgetOlderJobs(setId: string, keepJobId: string) {
  const old = await prisma.exportJob.findMany({ where: { setId, id: { not: keepJobId } } });
  for (const job of old) {
    if (job.filePath) await deleteStorageFile(job.filePath).catch(() => {});
  }
  await prisma.exportJob.deleteMany({ where: { setId, id: { not: keepJobId } } });
}

/**
 * Run the export for an already-created job row, recording progress as it goes.
 * Never throws: a failure is reported through the row, which is all the client
 * can see.
 */
export async function runExportJob(jobId: string): Promise<void> {
  const job = await prisma.exportJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "PENDING") return;
  await prisma.exportJob.update({ where: { id: jobId }, data: { status: "RUNNING" } });

  // Progress writes never block the export — it must not run at the speed of
  // the database — but they are chained and awaited before the terminal write,
  // or a late one would land on top of it and undo the final state.
  let lastWrite = 0;
  let lastPhase = "";
  let writes: Promise<unknown> = Promise.resolve();
  const onProgress = ({ phase, done, total }: ExportProgress) => {
    const now = Date.now();
    if (phase === lastPhase && now - lastWrite < PROGRESS_INTERVAL_MS) return;
    lastWrite = now;
    lastPhase = phase;
    writes = writes.then(() =>
      prisma.exportJob.update({ where: { id: jobId }, data: { phase, done, total } }).catch(() => {}),
    );
  };

  try {
    const bytes = await exportSetPdf(job.setId, onProgress);
    const filePath = exportPath(job.setId, jobId);
    await writeStorageFile(filePath, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    await writes;
    await prisma.exportJob.update({
      where: { id: jobId },
      data: { status: "DONE", filePath, bytes: bytes.byteLength, phase: "saving", done: 1, total: 1 },
    });
    await forgetOlderJobs(job.setId, jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writes.catch(() => {});
    await prisma.exportJob
      .update({ where: { id: jobId }, data: { status: "FAILED", error: message } })
      .catch(() => {});
  }
}
