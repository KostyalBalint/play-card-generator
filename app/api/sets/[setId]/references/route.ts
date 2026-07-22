import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { writeStorageFile } from "@/lib/storage";

export const maxDuration = 60;

/** Uploads bigger than this are rejected before decoding. */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Upload a picture to use as a generation reference for this set. Multipart
 * form data: { file, name? }. Anything sharp can read is normalised to PNG so
 * the image-edit call gets the same format as generated art.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const set = await prisma.cardSet.findUnique({ where: { id: setId }, select: { id: true } });
  if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File is larger than 20MB" }, { status: 413 });
  }

  let png: Buffer;
  let meta: sharp.Metadata;
  try {
    png = await sharp(Buffer.from(await file.arrayBuffer())).png().toBuffer();
    meta = await sharp(png).metadata();
  } catch {
    return NextResponse.json({ error: "Not a readable image file" }, { status: 400 });
  }

  const name = String(form.get("name") ?? "").trim() || file.name || "Uploaded reference";
  const record = await prisma.referenceImage.create({
    data: { setId, name, filePath: "", widthPx: meta.width ?? null, heightPx: meta.height ?? null },
  });
  const filePath = `references/${setId}/${record.id}.png`;
  await writeStorageFile(filePath, png);
  await prisma.referenceImage.update({ where: { id: record.id }, data: { filePath } });

  return NextResponse.json({ id: record.id, name });
}

/** Every reference picture uploaded to this set, newest first. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const images = await prisma.referenceImage.findMany({
    where: { setId, filePath: { not: "" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });
  return NextResponse.json(images);
}
