// src/app/components/LightboxGallery.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

export type GalleryItem = {
  id: string;
  url: string;
  title?: string | null;
  isVideo?: boolean;
};

export default function LightboxGallery({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  const close = () => setOpen(false);
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + items.length) % items.length),
    [items.length]
  );
  const next = useCallback(
    () => setIndex((i) => (i + 1) % items.length),
    [items.length]
  );

  // клавиатура: Esc/←/→
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

  return (
    <div>
      {/* Лента превьюшек */}
      <div className="overflow-x-auto">
        <div className="flex gap-3 py-1">
          {items.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className="shrink-0 w-64 group outline-none"
              onClick={() => openAt(i)}
              aria-label="Открыть медиа"
            >
              <div className="aspect-video bg-gray-50 rounded overflow-hidden flex items-center justify-center ring-1 ring-inset ring-gray-200 group-hover:ring-gray-300">
                {m.isVideo ? (
                  <video
                    src={m.url}
                    preload="metadata"
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.url}
                    alt={m.title || ""}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              {/* Подпись под превью удалена */}
            </button>
          ))}
        </div>
      </div>

      {/* Лайтбокс */}
      {open && items[index] && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/90 text-white flex flex-col"
          onClick={close}
        >
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          <div
            className="flex-1 flex items-center justify-center px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="hidden md:block px-3 py-2 rounded bg-white/10 hover:bg-white/20 mr-3"
              onClick={prev}
              aria-label="Предыдущее"
            >
              ←
            </button>

            <div className="max-w-[min(92vw,1100px)] max-h-[80vh] w-full flex items-center justify-center">
              {items[index].isVideo ? (
                <video
                  src={items[index].url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[80vh] max-w-full object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={items[index].url}
                  alt={items[index].title || ""}
                  className="max-h-[80vh] max-w-full object-contain"
                />
              )}
            </div>

            <button
              type="button"
              className="hidden md:block px-3 py-2 rounded bg-white/10 hover:bg-white/20 ml-3"
              onClick={next}
              aria-label="Следующее"
            >
              →
            </button>
          </div>

          {/* Подпись только в режиме просмотра и только если есть title */}
          {items[index].title && (
            <div className="px-4 pb-5 text-sm opacity-80 text-center">
              {items[index].title}
            </div>
          )}

          {/* Мобильные кнопки */}
          <div className="md:hidden fixed bottom-4 left-0 right-0 flex items-center justify-center gap-3">
            <button
              type="button"
              className="px-3 py-1.5 rounded bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              aria-label="Предыдущее"
            >
              ←
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
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
