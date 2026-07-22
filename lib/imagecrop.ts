import sharp from "sharp";

/**
 * Center cover-crop, downscale to a print size and JPEG-encode — the form the
 * PDF export embeds. Lossless PNG is the wrong tool there: pdf-lib decodes a PNG
 * to raw pixels and re-deflates it, so a full-size card costs megabytes of PDF
 * and a multiple of that in RSS, which is what made big sets OOM the export.
 * JPEG bytes are embedded as-is. Never use this for images that get re-cropped
 * or re-generated later (map/panorama slices) — those stay PNG.
 */
export async function coverCropJpeg(
  buf: Buffer,
  targetRatio: number,
  targetWidthPx: number,
  quality = 88,
): Promise<Buffer> {
  return sharp(await coverCrop(buf, targetRatio))
    // Never upscale: a small source stays small rather than growing the file.
    .resize({ width: targetWidthPx, withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

/** Center cover-crop a PNG buffer to the given width/height aspect ratio. */
export async function coverCrop(buf: Buffer, targetRatio: number): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const srcW = meta.width ?? 1024;
  const srcH = meta.height ?? 1024;
  let cropW = srcW;
  let cropH = Math.round(srcW / targetRatio);
  if (cropH > srcH) {
    cropH = srcH;
    cropW = Math.round(srcH * targetRatio);
  }
  return sharp(buf)
    .extract({
      left: Math.floor((srcW - cropW) / 2),
      top: Math.floor((srcH - cropH) / 2),
      width: cropW,
      height: cropH,
    })
    .png()
    .toBuffer();
}
