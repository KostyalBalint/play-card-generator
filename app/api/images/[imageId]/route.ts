import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readStorageFile } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  const image = await prisma.generatedImage.findUnique({ where: { id: imageId } });
  if (!image?.filePath || image.status !== "DONE") {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
  const bytes = await readStorageFile(image.filePath);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
