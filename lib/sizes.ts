import type { SizePreset } from "@/lib/generated/prisma/client";

export const SIZE_PRESETS: Record<Exclude<SizePreset, "CUSTOM">, { widthMm: number; heightMm: number }> = {
  POKER: { widthMm: 63.5, heightMm: 88.9 },
  TAROT: { widthMm: 70, heightMm: 120 },
};

export function sizeForSet(set: { sizePreset: SizePreset; widthMm: number; heightMm: number }) {
  if (set.sizePreset === "CUSTOM") return { widthMm: set.widthMm, heightMm: set.heightMm };
  return SIZE_PRESETS[set.sizePreset];
}
