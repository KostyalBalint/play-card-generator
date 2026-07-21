import type { FaceOverlay } from "@/lib/overlay";

/**
 * Rendered (not baked) overlay drawn over a face image — see lib/overlay.
 * Geometry mirrors drawOverlay in lib/pdf/export so screen matches print: the
 * label sits dead centre, the caption is bottom-centred one inset up. Font =
 * 10% of card height, caption = 45% of that, inset = 5% of card width, plate
 * padding = 0.4/0.25em. Sizes in cqw, so the parent must be a
 * `[container-type:inline-size]` box with the card's aspect ratio.
 */
export function FaceOverlayLabel({
  overlay,
  widthMm,
  heightMm,
}: {
  overlay: FaceOverlay;
  widthMm: number;
  heightMm: number;
}) {
  const size = (10 * heightMm) / widthMm;
  // rounded radius = 0.3em, matching roundedRectPath in lib/pdf/export
  const plate = "rounded-[0.3em] bg-black/55 text-white";
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ fontSize: `${size}cqw` }}
    >
      {overlay.label ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={plate} style={{ padding: "0.25em 0.4em" }}>
            <span className="font-bold leading-none tracking-wide">{overlay.label}</span>
          </div>
        </div>
      ) : null}
      {overlay.caption ? (
        <div
          className="absolute left-1/2 flex -translate-x-1/2 justify-center"
          style={{ bottom: "5cqw" }}
        >
          <div className={plate} style={{ padding: "0.25em 0.4em", fontSize: "0.45em" }}>
            <span className="whitespace-nowrap font-medium leading-none">{overlay.caption}</span>
          </div>
        </div>
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
  className = "",
}: {
  activeImageId: string | null | undefined;
  widthMm: number;
  heightMm: number;
  label?: string;
  /** Rendered (not baked) label + caption drawn over the image — see lib/overlay. */
  overlay?: FaceOverlay | null;
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
      {overlay ? <FaceOverlayLabel overlay={overlay} widthMm={widthMm} heightMm={heightMm} /> : null}
    </div>
  );
}
