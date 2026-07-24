/**
 * Placement + look of the rendered (not baked) overlay drawn over a card face —
 * see lib/overlay for *what* text is drawn. Stored per face in
 * CardFace.overlayStyle, so a shared back carries its own text arrangement and
 * every card using that back inherits it.
 *
 * All geometry is expressed in card fractions so the CSS preview
 * (components/CardFacePreview) and the PDF (lib/pdf/export) can share the math.
 */

export type OverlayAnchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export type OverlayFont =
  | "sans"
  | "serif"
  | "mono"
  | "cinzel"
  | "playfair"
  | "imfell"
  | "oswald"
  | "bebas"
  | "amatic"
  | "specialElite"
  | "gloria";

type FontFiles = {
  regular: string;
  /** null = the family has no bold cut, so the bold toggle is a no-op for it. */
  bold: string | null;
  /**
   * Subset the embedded font instead of shipping the whole file. pdf-lib's
   * subsetter drops glyphs on several of these faces (and shipping the full file
   * crashes fontkit on Bebas), so the flag is per family and set to whatever was
   * verified to render — do not flip it without re-checking a printed PDF.
   */
  subset: boolean;
};

/**
 * Vertical metrics of a family, in em. `ascent`/`descent` are the hhea values the
 * browser uses for half-leading (descent positive here); `capHeight` is measured
 * from the H glyph's bbox rather than the OS/2 field, which several of these
 * faces get wrong (Special Elite reports half its real cap height, Gloria's is
 * inflated by the slant). Regular and bold agree to <0.01em, so one set per family.
 * Regenerate with fontkit over public/fonts if a font file is ever swapped.
 */
export type FontMetrics = { ascent: number; descent: number; capHeight: number };

/**
 * The fonts an overlay can use — all OFL families bundled in public/fonts. The
 * same files back the PDF (embedded via fontkit) and the browser preview
 * (@font-face in app/globals.css), so screen matches print.
 *
 * The three plain families are Noto rather than PDF's built-in
 * Helvetica/Times/Courier: those are encoded WinAnsi, which cannot represent
 * Latin Extended-A — a Hungarian ő or a Polish ł killed the whole export.
 */
export const FONT_CATALOG: Record<
  OverlayFont,
  { label: string; css: string; files: FontFiles; metrics: FontMetrics }
> = {
  sans: {
    label: "Sans (Noto Sans)",
    css: '"Noto Sans", Arial, sans-serif',
    files: { regular: "notosans-400.ttf", bold: "notosans-700.ttf", subset: false },
    metrics: { ascent: 1.069, descent: 0.293, capHeight: 0.724 },
  },
  serif: {
    label: "Serif (Noto Serif)",
    css: '"Noto Serif", "Times New Roman", serif',
    files: { regular: "notoserif-400.ttf", bold: "notoserif-700.ttf", subset: false },
    metrics: { ascent: 1.069, descent: 0.293, capHeight: 0.724 },
  },
  mono: {
    label: "Mono (Noto Sans Mono)",
    css: '"Noto Sans Mono", "Courier New", monospace',
    files: { regular: "notomono-400.ttf", bold: "notomono-700.ttf", subset: false },
    metrics: { ascent: 1.069, descent: 0.293, capHeight: 0.724 },
  },
  cinzel: {
    label: "Cinzel — roman caps",
    css: '"Cinzel", serif',
    files: { regular: "cinzel-400.ttf", bold: "cinzel-700.ttf", subset: false },
    metrics: { ascent: 0.976, descent: 0.372, capHeight: 0.714 },
  },
  playfair: {
    label: "Playfair — display serif",
    css: '"Playfair Display", serif',
    files: { regular: "playfair-400.ttf", bold: "playfair-700.ttf", subset: false },
    metrics: { ascent: 1.082, descent: 0.251, capHeight: 0.722 },
  },
  imfell: {
    label: "IM Fell English — old book",
    css: '"IM Fell English", serif',
    files: { regular: "imfell-400.ttf", bold: null, subset: false },
    metrics: { ascent: 0.905, descent: 0.363, capHeight: 0.682 },
  },
  oswald: {
    label: "Oswald — condensed",
    css: '"Oswald", sans-serif',
    files: { regular: "oswald-400.ttf", bold: "oswald-700.ttf", subset: false },
    metrics: { ascent: 1.193, descent: 0.289, capHeight: 0.817 },
  },
  bebas: {
    label: "Bebas Neue — poster caps",
    css: '"Bebas Neue", sans-serif',
    files: { regular: "bebas-400.ttf", bold: null, subset: true },
    metrics: { ascent: 0.9, descent: 0.3, capHeight: 0.71 },
  },
  amatic: {
    label: "Amatic SC — thin caps",
    css: '"Amatic SC", cursive',
    files: { regular: "amatic-400.ttf", bold: "amatic-700.ttf", subset: false },
    metrics: { ascent: 1.016, descent: 0.245, capHeight: 0.786 },
  },
  specialElite: {
    label: "Special Elite — typewriter",
    css: '"Special Elite", cursive',
    files: { regular: "specialelite-400.ttf", bold: null, subset: false },
    metrics: { ascent: 0.703, descent: 0.297, capHeight: 0.72 },
  },
  gloria: {
    label: "Gloria Hallelujah — handwritten",
    css: '"Gloria Hallelujah", cursive',
    files: { regular: "gloria-400.ttf", bold: null, subset: false },
    metrics: { ascent: 1.405, descent: 0.577, capHeight: 0.739 },
  },
};

export const OVERLAY_FONTS = Object.keys(FONT_CATALOG) as OverlayFont[];

export type OverlayTextStyle = {
  anchor: OverlayAnchor;
  /** Nudge from the anchor, % of card width / height. + is right / down. */
  offsetXPct: number;
  offsetYPct: number;
  /** Font size as % of card height. */
  sizePct: number;
  /** Text colour, #rrggbb. */
  color: string;
  /** Text opacity, 0-100. 100 = fully opaque. */
  textOpacity: number;
  /** Plate (the slab behind the text) colour + opacity; 0 opacity = no plate. */
  plateColor: string;
  plateOpacity: number;
  font: OverlayFont;
  bold: boolean;
};

/** The two overlay slots: the big label and the small caption. */
export type OverlayStyle = { label: OverlayTextStyle; caption: OverlayTextStyle };

/** Margin from the card edge for edge anchors, as a fraction of card width. */
export const MARGIN_FRAC = 0.05;

/** The historic hardcoded look: centred label, small bottom caption, dark plates. */
export const DEFAULT_OVERLAY_STYLE: OverlayStyle = {
  label: {
    anchor: "center",
    offsetXPct: 0,
    offsetYPct: 0,
    sizePct: 10,
    color: "#ffffff",
    textOpacity: 100,
    plateColor: "#000000",
    plateOpacity: 55,
    font: "sans",
    bold: true,
  },
  caption: {
    anchor: "bottom",
    offsetXPct: 0,
    offsetYPct: 0,
    sizePct: 4.5,
    color: "#ffffff",
    textOpacity: 100,
    plateColor: "#000000",
    plateOpacity: 55,
    font: "sans",
    bold: false,
  },
};

const ANCHORS: OverlayAnchor[] = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
];

function clamp(n: number, min: number, max: number, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function hex(value: unknown, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : fallback;
}

/** Plate presets from before the colour/opacity split — kept readable on old rows. */
const LEGACY_PLATE: Record<string, { plateColor: string; plateOpacity: number }> = {
  dark: { plateColor: "#000000", plateOpacity: 55 },
  light: { plateColor: "#ffffff", plateOpacity: 80 },
  none: { plateColor: "#000000", plateOpacity: 0 },
};

function parseText(raw: unknown, fallback: OverlayTextStyle): OverlayTextStyle {
  const r = (raw ?? {}) as Partial<OverlayTextStyle> & { plate?: string };
  const legacy = typeof r.plate === "string" ? LEGACY_PLATE[r.plate] : undefined;
  return {
    anchor: pick(r.anchor, ANCHORS, fallback.anchor),
    offsetXPct: clamp(r.offsetXPct as number, -50, 50, fallback.offsetXPct),
    offsetYPct: clamp(r.offsetYPct as number, -50, 50, fallback.offsetYPct),
    sizePct: clamp(r.sizePct as number, 1, 40, fallback.sizePct),
    color: hex(r.color, fallback.color),
    textOpacity: clamp(r.textOpacity as number, 0, 100, fallback.textOpacity),
    plateColor: hex(r.plateColor, legacy?.plateColor ?? fallback.plateColor),
    plateOpacity: clamp(
      r.plateOpacity as number,
      0,
      100,
      legacy?.plateOpacity ?? fallback.plateOpacity,
    ),
    font: pick(r.font, OVERLAY_FONTS, fallback.font),
    bold: typeof r.bold === "boolean" ? r.bold : fallback.bold,
  };
}

/** Tolerant read of the JSON column — anything missing or bogus falls back to the default. */
export function parseOverlayStyle(raw: unknown): OverlayStyle {
  const r = (raw ?? {}) as Partial<OverlayStyle>;
  return {
    label: parseText(r.label, DEFAULT_OVERLAY_STYLE.label),
    caption: parseText(r.caption, DEFAULT_OVERLAY_STYLE.caption),
  };
}

export type Placement = {
  /** Anchor point in card fractions, top-left origin. */
  xFrac: number;
  yFrac: number;
  /** How the text plate sits relative to that point. */
  alignX: "start" | "center" | "end";
  alignY: "start" | "center" | "end";
};

/**
 * Where a slot's plate goes. `aspect` is cardWidth/cardHeight — edge margins are
 * width-based on both axes so they read as equal on the printed card.
 */
export function placement(style: OverlayTextStyle, aspect: number): Placement {
  const marginX = MARGIN_FRAC;
  const marginY = MARGIN_FRAC * aspect;
  const left = style.anchor.includes("left");
  const right = style.anchor.includes("right");
  const top = style.anchor.startsWith("top");
  const bottom = style.anchor.startsWith("bottom");
  return {
    xFrac: (left ? marginX : right ? 1 - marginX : 0.5) + style.offsetXPct / 100,
    yFrac: (top ? marginY : bottom ? 1 - marginY : 0.5) + style.offsetYPct / 100,
    alignX: left ? "start" : right ? "end" : "center",
    alignY: top ? "start" : bottom ? "end" : "center",
  };
}

/** Plate fill for a slot: null when the text is drawn bare. */
export function plateFill(style: OverlayTextStyle): { color: string; opacity: number } | null {
  if (style.plateOpacity <= 0) return null;
  return { color: style.plateColor, opacity: style.plateOpacity / 100 };
}

/** #rrggbb → 0..1 channel triple. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return { r: 1, g: 1, b: 1 };
  return {
    r: parseInt(m[1], 16) / 255,
    g: parseInt(m[2], 16) / 255,
    b: parseInt(m[3], 16) / 255,
  };
}

/** Plate padding, in em of the slot's font size — shared by preview and PDF. */
export const PLATE_PAD_X_EM = 0.4;
export const PLATE_PAD_Y_EM = 0.25;
export const PLATE_RADIUS_EM = 0.3;

/** Height of the text line box inside the plate, in em. */
export const TEXT_BOX_EM = 1;

/** Total plate height in em: the line box plus PLATE_PAD_Y_EM top and bottom. */
export const PLATE_H_EM = TEXT_BOX_EM + 2 * PLATE_PAD_Y_EM;

/**
 * Where the baseline sits below the plate's top edge, in em.
 *
 * The anchor centres the *plate*, so the text has to be centred inside it or the
 * whole overlay reads as shifted. Centring the em box does not do that: the box
 * reserves descender room that "12" or "A" never fills, and the ascent/descent
 * split differs wildly per family. So centre the cap band — baseline to cap
 * height — which is what the eye reads as centred for numbers, letters and
 * ordinary text alike. Descenders hang into the bottom padding, as intended.
 */
export function baselineFromPlateTopEm(font: OverlayFont): number {
  return PLATE_H_EM / 2 + FONT_CATALOG[font].metrics.capHeight / 2;
}

/**
 * Em correction for the CSS preview: the browser puts the baseline wherever
 * half-leading lands it (line box centred on ascent+descent, hhea metrics for
 * these TTFs), which is not the cap-centred baseline above. Apply the difference
 * as a translateY on the text so the preview lands where the PDF draws it.
 */
export function previewBaselineShiftEm(font: OverlayFont): number {
  const { ascent, descent } = FONT_CATALOG[font].metrics;
  const cssBaseline = PLATE_PAD_Y_EM + (TEXT_BOX_EM - (ascent + descent)) / 2 + ascent;
  return baselineFromPlateTopEm(font) - cssBaseline;
}
