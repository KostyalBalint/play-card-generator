import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exportSetPdf } from "@/lib/pdf/export";

export const maxDuration = 120;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const set = await prisma.cardSet.findUnique({ where: { id: setId } });
  if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });

  const bytes = await exportSetPdf(setId);
  const filename = `${set.name.replace(/[^a-z0-9-_]+/gi, "_")}.pdf`;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
