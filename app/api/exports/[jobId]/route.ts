import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jobView } from "@/lib/pdf/job";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await prisma.exportJob.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Export not found" }, { status: 404 });
  return NextResponse.json(jobView(job));
}
