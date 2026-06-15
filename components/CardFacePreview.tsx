export function CardFacePreview({
  activeImageId,
  widthMm,
  heightMm,
  label,
  overlayLabel,
  className = "",
}: {
  activeImageId: string | null | undefined;
  widthMm: number;
  heightMm: number;
  label?: string;
  /** Rendered (not baked) position label drawn over the image — see lib/overlay. */
  overlayLabel?: string | null;
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
      {overlayLabel ? (
        <div className="pointer-events-none absolute left-[6%] top-[5%] flex items-center justify-center rounded-md bg-black/55 px-[0.5em] py-[0.15em] text-white shadow-sm backdrop-blur-[1px]">
          <span
            className="font-bold leading-none tracking-wide"
            style={{ fontSize: "clamp(0.6rem, 9cqw, 2rem)" }}
          >
            {overlayLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}
