import { NextRequest, NextResponse } from "next/server";
import { toFile } from "openai";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { openai, IMAGE_MODEL } from "@/lib/openai";
import { buildEditPrompt, buildImagePrompt, buildPromptWithReference, buildTextAlterPrompt } from "@/lib/prompts";
import { readStorageFile, writeStorageFile } from "@/lib/storage";
import { sizeForSet } from "@/lib/sizes";

export const maxDuration = 300;

function apiImageSize(widthMm: number, heightMm: number): "1024x1024" | "1024x1536" | "1536x1024" {
  const ratio = widthMm / heightMm;
  if (ratio < 0.9) return "1024x1536";
  if (ratio > 1.1) return "1536x1024";
  return "1024x1024";
}

async function faceContext(faceId: string) {
  const face = await prisma.cardFace.findUnique({
    where: { id: faceId },
    include: {
      frontOfCard: { include: { set: true } },
      backOfCards: { include: { set: true }, take: 1 },
      sharedBackOfSet: true,
      panoramaOfLocation: { include: { set: true, cards: { where: { inPanorama: true } } } },
    },
  });
  if (!face) return null;
  const set =
    face.sharedBackOfSet ??
    face.frontOfCard?.set ??
    face.backOfCards[0]?.set ??
    face.panoramaOfLocation?.set ??
    null;
  // Item numbers live only on the back overlay — never bake them onto the front.
  const cardNumber =
    set?.showNumbers && !face.frontOfCard?.isItem ? face.frontOfCard?.number ?? null : null;
  // Panorama faces are generated wide: one image spanning N member cards side-by-side.
  const panoramaSpan = face.panoramaOfLocation ? Math.max(1, face.panoramaOfLocation.cards.length) : 0;
  return { face, set, cardNumber, panoramaSpan };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ faceId: string }> }) {
  const { faceId } = await params;
  const ctx = await faceContext(faceId);
  if (!ctx || !ctx.set) {
    return NextResponse.json({ error: "Face or owning set not found" }, { status: 404 });
  }
  const { face, set, cardNumber, panoramaSpan } = ctx;

  // Optional body: { referenceImageId, alterPrompt } switches to image-edit mode.
  // The plain-generate client sends no body at all — req.json() would throw.
  let body: { referenceImageId?: string; alterPrompt?: string; useFacePrompt?: boolean; alterText?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // no body — plain generation
  }

  let reference: { id: string; png: Buffer } | null = null;
  if (body.referenceImageId) {
    // Reference modes: alter (free-text instruction), face-prompt (full front prompt
    // for visual consistency), or text-alter (bake the face's title/body onto the image).
    if (!body.useFacePrompt && !body.alterText && !body.alterPrompt?.trim()) {
      return NextResponse.json({ error: "alterPrompt is required in edit mode" }, { status: 400 });
    }
    const refImage = await prisma.generatedImage.findUnique({
      where: { id: body.referenceImageId },
      include: {
        face: {
          include: {
            frontOfCard: true,
            backOfCards: { take: 1 },
            sharedBackOfSet: true,
            panoramaOfLocation: true,
          },
        },
      },
    });
    if (!refImage || refImage.status !== "DONE" || !refImage.filePath) {
      return NextResponse.json({ error: "Reference image not found or not ready" }, { status: 400 });
    }
    const refSetId =
      refImage.face.sharedBackOfSet?.id ??
      refImage.face.frontOfCard?.setId ??
      refImage.face.backOfCards[0]?.setId ??
      refImage.face.panoramaOfLocation?.setId ??
      null;
    if (refSetId !== set.id) {
      return NextResponse.json({ error: "Reference image belongs to a different set" }, { status: 400 });
    }
    reference = { id: refImage.id, png: await readStorageFile(refImage.filePath) };
  }

  const resolvedPrompt = reference
    ? body.alterText
      ? buildTextAlterPrompt(face, set)
      : body.useFacePrompt
        ? buildPromptWithReference(face, set, cardNumber)
        : buildEditPrompt(body.alterPrompt!, set)
    : buildImagePrompt(face, set, cardNumber);

  const record = await prisma.generatedImage.create({
    data: { faceId, status: "PENDING", resolvedPrompt, sourceImageId: reference?.id ?? null },
  });

  try {
    const { widthMm, heightMm } = sizeForSet(set);
    // Panorama: one wide image spanning panoramaSpan cards side-by-side.
    const size = panoramaSpan > 0 ? "1536x1024" : apiImageSize(widthMm, heightMm);

    const result = reference
      ? await openai.images.edit({
          model: IMAGE_MODEL,
          image: await toFile(reference.png, "ref.png", { type: "image/png" }),
          prompt: resolvedPrompt,
          size,
          quality: "medium",
          output_format: "png",
        })
      : await openai.images.generate({
          model: IMAGE_MODEL,
          prompt: resolvedPrompt,
          size,
          quality: "medium",
          output_format: "png",
        });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data in OpenAI response");

    // Store the uncropped master so re-editing keeps the original margin (no progressive
    // zoom). Card-aspect cropping happens only at PDF export time.
    const raw = Buffer.from(b64, "base64");
    const png = await sharp(raw).png().toBuffer();
    const meta = await sharp(png).metadata();

    const filePath = `images/${set.id}/${record.id}.png`;
    await writeStorageFile(filePath, png);

    await prisma.$transaction([
      prisma.generatedImage.update({
        where: { id: record.id },
        data: { status: "DONE", filePath, widthPx: meta.width ?? null, heightPx: meta.height ?? null },
      }),
      prisma.cardFace.update({
        where: { id: faceId },
        data: { activeImageId: record.id },
      }),
    ]);

    return NextResponse.json({ id: record.id, status: "DONE" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.generatedImage.update({
      where: { id: record.id },
      data: { status: "FAILED", error: message },
    });
    return NextResponse.json({ id: record.id, status: "FAILED", error: message }, { status: 502 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ faceId: string }> }) {
  const { faceId } = await params;
  const latest = await prisma.generatedImage.findFirst({
    where: { faceId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(latest ? { id: latest.id, status: latest.status, error: latest.error } : { status: "NONE" });
}
