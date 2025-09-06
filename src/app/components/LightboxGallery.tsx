// app/components/LightboxGallery.tsx

"use client";

import { useCallback, useEffect, useState } from "react";

export type GalleryItem = { id: string; url: string; title?: string | null; isVideo?: boolean };

export default function LightboxGallery({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const openAt = (i: number) => { setIndex(i); setOpen(true); };
  const close = () => setOpen(false);
  const prev = useCallback(() => setIndex((i) => (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % items.length), [items.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); if (e.key === "ArrowLeft") prev(); if (e.key === "ArrowRight") next(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, prev, next]);

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="flex gap-3 py-1">
          {items.map((m, i) => (
            <button key={m.id} type="button" className="group w-64 shrink-0 outline-none" onClick={() => openAt(i)} aria-label="Открыть медиа">
              <div className="aspect-video overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200 transition hover:ring-neutral-300">
                {m.isVideo ? (
                  <video src={m.url} preload="metadata" playsInline muted className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.title || ""} loading="lazy" className="h-full w-full object-cover" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {open && items[index] && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white" onClick={close}>
          <div className="absolute right-3 top-3">
            <button type="button" className="rounded bg-white/10 px-3 py-1.5 hover:bg-white/20" onClick={(e) => { e.stopPropagation(); close(); }} aria-label="Закрыть">
              ✕
            </button>
          </div>

          <div className="flex-1 items-center justify-center px-4 md:flex" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="mr-3 hidden rounded bg-white/10 px-3 py-2 hover:bg-white/20 md:block" onClick={prev} aria-label="Предыдущее">
              ←
            </button>

            <div className="flex max-h-[80vh] w-full max-w-[min(92vw,1100px)] items-center justify-center">
              {items[index].isVideo ? (
                <video src={items[index].url} controls autoPlay playsInline className="max-h-[80vh] max-w-full object-contain" />
              ) : (
                <img src={items[index].url} alt={items[index].title || ""} className="max-h-[80vh] max-w-full object-contain" />
              )}
            </div>

            <button type="button" className="ml-3 hidden rounded bg-white/10 px-3 py-2 hover:bg-white/20 md:block" onClick={next} aria-label="Следующее">
              →
            </button>
          </div>

          {items[index].title && <div className="px-4 pb-5 text-center text-sm opacity-80">{items[index].title}</div>}

          <div className="fixed bottom-4 left-0 right-0 flex items-center justify-center gap-3 md:hidden">
            <button type="button" className="rounded bg-white/10 px-3 py-1.5" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Предыдущее">
              ←
            </button>
            <button type="button" className="rounded bg-white/10 px-3 py-1.5" onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Следующее">
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
