export function CardFacePreview({
  activeImageId,
  widthMm,
  heightMm,
  label,
  className = "",
}: {
  activeImageId: string | null | undefined;
  widthMm: number;
  heightMm: number;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-zinc-300 bg-zinc-100 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 ${className}`}
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
    </div>
  );
}
