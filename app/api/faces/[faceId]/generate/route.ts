import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { openai, IMAGE_MODEL } from "@/lib/openai";
import { buildImagePrompt } from "@/lib/prompts";
import { writeStorageFile } from "@/lib/storage";
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
    },
  });
  if (!face) return null;
  const set = face.sharedBackOfSet ?? face.frontOfCard?.set ?? face.backOfCards[0]?.set ?? null;
  const cardNumber = face.frontOfCard?.number ?? null;
  return { face, set, cardNumber };
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ faceId: string }> }) {
  const { faceId } = await params;
  const ctx = await faceContext(faceId);
  if (!ctx || !ctx.set) {
    return NextResponse.json({ error: "Face or owning set not found" }, { status: 404 });
  }
  const { face, set, cardNumber } = ctx;

  const resolvedPrompt = buildImagePrompt(face, set, cardNumber);
  const record = await prisma.generatedImage.create({
    data: { faceId, status: "PENDING", resolvedPrompt },
  });

  try {
    const { widthMm, heightMm } = sizeForSet(set);
    const result = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: resolvedPrompt,
      size: apiImageSize(widthMm, heightMm),
      quality: "high",
      output_format: "png",
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data in OpenAI response");

    // Cover-crop to the exact card aspect ratio so the PDF never distorts
    const raw = Buffer.from(b64, "base64");
    const meta = await sharp(raw).metadata();
    const srcW = meta.width ?? 1024;
    const srcH = meta.height ?? 1536;
    const targetRatio = widthMm / heightMm;
    let cropW = srcW;
    let cropH = Math.round(srcW / targetRatio);
    if (cropH > srcH) {
      cropH = srcH;
      cropW = Math.round(srcH * targetRatio);
    }
    const png = await sharp(raw)
      .extract({
        left: Math.floor((srcW - cropW) / 2),
        top: Math.floor((srcH - cropH) / 2),
        width: cropW,
        height: cropH,
      })
      .png()
      .toBuffer();

    const filePath = `images/${set.id}/${record.id}.png`;
    await writeStorageFile(filePath, png);

    await prisma.$transaction([
      prisma.generatedImage.update({
        where: { id: record.id },
        data: { status: "DONE", filePath, widthPx: cropW, heightPx: cropH },
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
