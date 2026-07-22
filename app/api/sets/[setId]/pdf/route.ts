import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jobView, latestExportJob, runExportJob, startExportJob } from "@/lib/pdf/job";

/**
 * Exporting a big set takes minutes, so the request only starts the job — the
 * work runs after the response through `after()`, and the client polls
 * /api/exports/[jobId]. See lib/pdf/job.
 */
export const maxDuration = 3600;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const set = await prisma.cardSet.findUnique({ where: { id: setId } });
  if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });

  const jobId = await startExportJob(setId);
  after(() => runExportJob(jobId));
  return NextResponse.json({ jobId });
}

/** The set's current (or last) export, so a page reload re-attaches to it. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const job = await latestExportJob(setId);
  return NextResponse.json(job ? jobView(job) : { status: "NONE" });
}
