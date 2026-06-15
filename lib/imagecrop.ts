import sharp from "sharp";

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
