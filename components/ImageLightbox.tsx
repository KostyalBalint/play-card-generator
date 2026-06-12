"use client";

import { useEffect, useRef, useState } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 8;

export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Native wheel listener — React's synthetic onWheel is passive, preventDefault would be ignored
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      setT((prev) => {
        const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
        if (scale === prev.scale) return prev;
        if (scale === MIN_SCALE) return { scale: 1, x: 0, y: 0 };
        // Keep the point under the cursor fixed while zooming
        const rect = el!.getBoundingClientRect();
        const cx = e.clientX - rect.left - rect.width / 2;
        const cy = e.clientY - rect.top - rect.height / 2;
        const ratio = scale / prev.scale;
        return { scale, x: cx - (cx - prev.x) * ratio, y: cy - (cy - prev.y) * ratio };
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, baseX: t.x, baseY: t.y };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const { startX, startY, baseX, baseY } = drag.current;
    setT((prev) => ({ ...prev, x: baseX + e.clientX - startX, y: baseY + e.clientY - startY }));
  }

  function onPointerUp(e: React.PointerEvent) {
    const wasDrag =
      drag.current &&
      Math.hypot(e.clientX - drag.current.startX, e.clientY - drag.current.startY) > 5;
    drag.current = null;
    setDragging(false);
    // Plain click (no drag) on the backdrop closes
    if (!wasDrag && e.target === containerRef.current) onClose();
  }

  function onDoubleClick(e: React.MouseEvent) {
    setT((prev) => {
      if (prev.scale > 1) return { scale: 1, x: 0, y: 0 };
      const el = containerRef.current!;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const scale = 2.5;
      return { scale, x: cx - cx * scale, y: cy - cy * scale };
    });
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      className={`fixed inset-0 z-50 flex touch-none items-center justify-center bg-black/85 ${
        t.scale > 1 ? "cursor-grab" : "cursor-zoom-in"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-h-[92vh] max-w-[92vw] select-none rounded-lg shadow-2xl"
        style={{
          transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`,
          transition: dragging ? "none" : "transform 120ms ease-out",
        }}
      />
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
      >
        ✕ Close
      </button>
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
        Scroll to zoom · drag to pan · double-click to toggle · Esc to close
      </div>
    </div>
  );
}
