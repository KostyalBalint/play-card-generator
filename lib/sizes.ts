import type { SizePreset } from "@/lib/generated/prisma/client";

export const SIZE_PRESETS: Record<Exclude<SizePreset, "CUSTOM">, { widthMm: number; heightMm: number }> = {
  POKER: { widthMm: 63.5, heightMm: 88.9 },
  TAROT: { widthMm: 70, heightMm: 120 },
  // 2:3 — the native aspect of the portrait image the generator returns
  // (1024x1536), so PDF export crops nothing off the generated art.
  IMAGE_2_3: { widthMm: 70, heightMm: 105 },
};

export function sizeForSet(set: { sizePreset: SizePreset; widthMm: number; heightMm: number }) {
  if (set.sizePreset === "CUSTOM") return { widthMm: set.widthMm, heightMm: set.heightMm };
  return SIZE_PRESETS[set.sizePreset];
}
