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
  // Hand the buffer over as-is — a big set's PDF is tens of MB and copying it
  // again just to change the view type doubles the peak memory for nothing.
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
