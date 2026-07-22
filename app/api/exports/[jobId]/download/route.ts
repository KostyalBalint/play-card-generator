import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exportFilename } from "@/lib/pdf/job";
import { readStorageStream } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await prisma.exportJob.findUnique({ where: { id: jobId }, include: { set: true } });
  if (!job?.filePath || job.status !== "DONE") {
    return NextResponse.json({ error: "Export not ready" }, { status: 404 });
  }

  // Streamed from disk: a big set's PDF is tens of MB and there is no reason to
  // hold it on the heap again just to hand it over.
  let file;
  try {
    file = await readStorageStream(job.filePath);
  } catch {
    return NextResponse.json({ error: "Export file is gone" }, { status: 404 });
  }
  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename="${exportFilename(job.set.name)}"`,
    },
  });
}
