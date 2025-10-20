// app/components/LightboxGallery.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GalleryItem = { id: string; url: string; title?: string | null; isVideo?: boolean };

export default function LightboxGallery({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);

  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };
  const close = () => setOpen(false);
  const prev = useCallback(() => setIndex((i) => (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % items.length), [items.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, prev, next]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].clientX;
    touchStartTime.current = Date.now();
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartX.current;
    if (startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dt = Date.now() - touchStartTime.current;
    touchStartX.current = null;
    if (dt < 600 && Math.abs(dx) > 48) {
      if (dx < 0) next();
      else prev();
    }
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="flex gap-3 py-1">
          {items.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className="group w-64 shrink-0 outline-none"
              onClick={() => openAt(i)}
              aria-label="Открыть медиа"
            >
              <div className="aspect-video overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200 transition hover:ring-neutral-300">
                {m.isVideo ? (
                  <video src={m.url} preload="metadata" playsInline muted className="h-full w-full object-cover" />
                ) : (
                  <img src={m.url} alt={m.title || ""} loading="lazy" className="h-full w-full object-cover" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {open && items[index] && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid grid-rows-[auto,1fr,auto,auto] bg-black/90 text-white"
          onClick={(e) => {
            if (e.currentTarget === e.target) close();
          }}
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div className="flex items-center justify-end px-4 py-3">
            <button
              type="button"
              className="rounded bg-white/10 px-3 py-1.5 hover:bg-white/20"
              onClick={close}
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center justify-center px-4">
            <button
              type="button"
              className="mr-3 hidden rounded bg-white/10 px-3 py-2 hover:bg-white/20 md:block"
              onClick={prev}
              aria-label="Предыдущее"
            >
              ←
            </button>

            <div
              className="flex max-h-[78vh] w-full max-w-[min(92vw,1100px)] items-center justify-center select-none"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {items[index].isVideo ? (
                <video
                  src={items[index].url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[78vh] max-w-full object-contain"
                />
              ) : (
                <img
                  src={items[index].url}
                  alt={items[index].title || ""}
                  className="max-h-[78vh] max-w-full object-contain"
                  draggable={false}
                />
              )}
            </div>

            <button
              type="button"
              className="ml-3 hidden rounded bg-white/10 px-3 py-2 hover:bg-white/20 md:block"
              onClick={next}
              aria-label="Следующее"
            >
              →
            </button>
          </div>

          {items[index].title && (
            <div className="px-4 pt-3 text-center text-sm opacity-80">{items[index].title}</div>
          )}

          <div className="flex items-center justify-center gap-3 px-4 py-4 md:hidden">
            <button
              type="button"
              className="rounded bg-white/10 px-3 py-1.5"
              onClick={prev}
              aria-label="Предыдущее"
            >
              ←
            </button>
            <button
              type="button"
              className="rounded bg-white/10 px-3 py-1.5"
              onClick={next}
              aria-label="Следующее"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
