import type { FaceOverlay } from "@/lib/overlay";
import {
  DEFAULT_OVERLAY_STYLE,
  FONT_CATALOG,
  PLATE_PAD_X_EM,
  PLATE_PAD_Y_EM,
  PLATE_RADIUS_EM,
  placement,
  plateFill,
  type OverlayStyle,
  type OverlayTextStyle,
} from "@/lib/overlaystyle";

/** One positioned text plate. Sizes are cqw, so the parent must be an inline-size container. */
function OverlaySlot({
  text,
  style,
  aspect,
}: {
  text: string;
  style: OverlayTextStyle;
  aspect: number;
}) {
  const p = placement(style, aspect);
  const fill = plateFill(style);
  const translate = (align: "start" | "center" | "end") =>
    align === "start" ? "0" : align === "center" ? "-50%" : "-100%";
  return (
    <div
      className="absolute"
      style={{
        left: `${p.xFrac * 100}%`,
        top: `${p.yFrac * 100}%`,
        transform: `translate(${translate(p.alignX)}, ${translate(p.alignY)})`,
        // sizePct is % of card height; cqw is % of card width.
        fontSize: `${style.sizePct / aspect}cqw`,
      }}
    >
      <div
        style={{
          padding: `${PLATE_PAD_Y_EM}em ${PLATE_PAD_X_EM}em`,
          borderRadius: `${PLATE_RADIUS_EM}em`,
          backgroundColor: fill ? hexWithAlpha(fill.color, fill.opacity) : "transparent",
        }}
      >
        <span
          className="whitespace-nowrap leading-none"
          style={{
            color: hexWithAlpha(style.color, style.textOpacity / 100),
            fontFamily: FONT_CATALOG[style.font].css,
            fontWeight: style.bold ? 700 : 400,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

/**
 * Rendered (not baked) overlay drawn over a face image — see lib/overlay for the
 * text, lib/overlaystyle for placement + look. Geometry mirrors drawOverlay in
 * lib/pdf/export so screen matches print.
 */
export function FaceOverlayLabel({
  overlay,
  widthMm,
  heightMm,
  style = DEFAULT_OVERLAY_STYLE,
}: {
  overlay: FaceOverlay;
  widthMm: number;
  heightMm: number;
  style?: OverlayStyle;
}) {
  const aspect = widthMm / heightMm;
  return (
    <div className="pointer-events-none absolute inset-0">
      {overlay.label ? <OverlaySlot text={overlay.label} style={style.label} aspect={aspect} /> : null}
      {overlay.caption ? (
        <OverlaySlot text={overlay.caption} style={style.caption} aspect={aspect} />
      ) : null}
    </div>
  );
}

export function CardFacePreview({
  activeImageId,
  widthMm,
  heightMm,
  label,
  overlay,
  overlayStyle,
  className = "",
}: {
  activeImageId: string | null | undefined;
  widthMm: number;
  heightMm: number;
  label?: string;
  /** Rendered (not baked) label + caption drawn over the image — see lib/overlay. */
  overlay?: FaceOverlay | null;
  /** Placement + look of that overlay; omitted = the built-in default. */
  overlayStyle?: OverlayStyle;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-zinc-300 bg-zinc-100 shadow-sm [container-type:inline-size] dark:border-zinc-700 dark:bg-zinc-800 ${className}`}
      style={{ aspectRatio: `${widthMm} / ${heightMm}` }}
    >
      {activeImageId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/images/${activeImageId}`}
          alt={label ?? "Card face"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-zinc-400">
          {label ?? "No image yet"}
        </div>
      )}
      {overlay ? (
        <FaceOverlayLabel
          overlay={overlay}
          widthMm={widthMm}
          heightMm={heightMm}
          style={overlayStyle}
        />
      ) : null}
    </div>
  );
}
