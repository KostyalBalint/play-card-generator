import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readStorageFile } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ refId: string }> }) {
  const { refId } = await params;
  const ref = await prisma.referenceImage.findUnique({ where: { id: refId } });
  if (!ref?.filePath) return NextResponse.json({ error: "Reference not found" }, { status: 404 });
  const bytes = await readStorageFile(ref.filePath);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

// Deleting lives in actions/references.deleteReference — it removes the PNG too.
