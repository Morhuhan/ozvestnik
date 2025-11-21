//C:\Users\radio\Projects\ozerskiy-vestnik\src\app\components\HeroCarousel.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMediaUrl } from "../../../lib/media";

export type HeroItem = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  image?: string | null;
  section?: { slug: string | null; name: string | null } | null;
  tags?: { id: string; slug: string; name: string }[];
};

type Props = {
  items: HeroItem[];
  intervalMs?: number;
};

const HEIGHT = "h-[220px] sm:h-[320px] md:h-[380px] lg:h-[440px] xl:h-[520px]";

export default function HeroCarousel({ items, intervalMs = 6000 }: Props) {
  const base = items.filter(Boolean);
  if (base.length === 0) return null;

  const slides = useMemo(() => {
    if (base.length === 1) return [base[0], base[0], base[0]];
    return [base[base.length - 1], ...base, base[0]];
  }, [base]);

  const [index, setIndex] = useState(1);
  const [withTransition, setWithTransition] = useState(true);
  const [progress, setProgress] = useState(0);

  const animatingRef = useRef(false);
  const snappingRef = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const router = useRouter();
  const autoAllowed = intervalMs > 0 && base.length > 1 && !prefersReducedMotion();

  function prefersReducedMotion() {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  const clearAuto = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const tick = () => {
    if (animatingRef.current || snappingRef.current) return;
    setIndex((i) => Math.min(slides.length - 1, i + 1));
  };

  const startAuto = () => {
    if (!autoAllowed) return;
    clearAuto();
    const stepMs = 50;
    const steps = Math.max(1, Math.round(intervalMs / stepMs));
    let k = 0;
    intervalRef.current = window.setInterval(() => {
      k += 1;
      setProgress((k / steps) * 100);
      if (k >= steps) {
        k = 0;
        setProgress(0);
        tick();
      }
    }, stepMs);
  };

  useEffect(() => {
    startAuto();
    return () => clearAuto();
  }, [autoAllowed, intervalMs, slides.length]);

  const handleTransitionStart = () => {
    animatingRef.current = true;
  };

  const handleTransitionEnd = () => {
    animatingRef.current = false;

    if (index === slides.length - 1) {
      snappingRef.current = true;
      setWithTransition(false);
      setIndex(1);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          snappingRef.current = false;
          setWithTransition(true);
        });
      });
    } else if (index === 0) {
      snappingRef.current = true;
      setWithTransition(false);
      setIndex(slides.length - 2);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          snappingRef.current = false;
          setWithTransition(true);
        });
      });
    }
  };

  const safeSetIndex = (i: number) => {
    if (animatingRef.current || snappingRef.current) return;
    setIndex(Math.max(0, Math.min(slides.length - 1, i)));
    setProgress(0);
  };

  const restartAuto = () => {
    startAuto();
  };

  const next = () => {
    safeSetIndex(index + 1);
    restartAuto();
  };

  const prev = () => {
    safeSetIndex(index - 1);
    restartAuto();
  };

  const goToDot = (dotIdx: number) => {
    safeSetIndex(dotIdx + 1);
    restartAuto();
  };

  const dotIndex = (index - 1 + base.length) % base.length;
  const openArticle = (slug: string) => router.push(`/news/${encodeURIComponent(slug)}`);

  const startX = useRef<number | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next();
      else prev();
    }
    startX.current = null;
  }

  return (
    <section
      className={`group relative overflow-hidden rounded-2xl ${HEIGHT}`}
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div
        className="flex h-full w-full will-change-transform"
        style={{
          transform: `translate3d(-${index * 100}%,0,0)`,
          transition: withTransition ? "transform 600ms cubic-bezier(.2,.8,.2,1)" : "none",
        }}
        onTransitionStart={handleTransitionStart}
        onTransitionEnd={handleTransitionEnd}
      >
        {slides.map((s, i) => (
          <Slide key={`${s.id}-${i}`} item={s} onOpen={() => openArticle(s.slug)} />
        ))}
      </div>

      {autoAllowed && (
        <div className="absolute left-0 right-0 bottom-0 h-1 bg-black/20">
          <div
            className="h-full bg-white/80 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {base.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              prev();
              (e.currentTarget as HTMLButtonElement).blur();
            }}
            aria-label="Предыдущий"
            className="pointer-events-auto absolute inset-y-0 left-0 w-12 sm:w-14 lg:w-16 flex items-center justify-center text-white text-3xl sm:text-4xl bg-black/0 hover:bg-black/30 active:bg-black/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              next();
              (e.currentTarget as HTMLButtonElement).blur();
            }}
            aria-label="Следующий"
            className="pointer-events-auto absolute inset-y-0 right-0 w-12 sm:w-14 lg:w-16 flex items-center justify-center text-white text-3xl sm:text-4xl bg-black/0 hover:bg-black/30 active:bg-black/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            ›
          </button>

          <div className="pointer-events-auto absolute bottom-4 left-0 right-0 flex justify-center gap-2">
            {base.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Слайд ${i + 1}`}
                onClick={() => goToDot(i)}
                className={`h-2.5 w-2.5 rounded-full border border-white/70 ${
                  i === dotIndex ? "bg-white" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Slide({ item, onOpen }: { item: HeroItem; onOpen: () => void }) {
  const tagChips = (item.tags ?? []).slice(0, 6);
  const imageId = item.image?.split("/").pop();

  return (
    <div className="relative h-full basis-full shrink-0">
      <div
        role="link"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className="block h-full cursor-pointer"
      >
        <div className="relative h-full w-full bg-neutral-200">
          {imageId ? (
            <img
              src={getMediaUrl(imageId, "XL")}
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
              без изображения
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 text-white">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide opacity-90">
            {item.section?.name ?? "Без раздела"}
          </div>
          <h2 className="text-xl font-bold leading-snug sm:text-2xl md:text-3xl">
            {item.title}
          </h2>
          {item.subtitle && (
            <p className="mt-2 max-w-2xl text-sm opacity-90 line-clamp-3">{item.subtitle}</p>
          )}

          {tagChips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tagChips.map((t) => (
                <Link
                  key={t.id}
                  href={`/search?tag=${encodeURIComponent(t.slug)}`}
                  className="pointer-events-auto rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20"
                  onClick={(e) => e.stopPropagation()}
                >
                  #{t.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}