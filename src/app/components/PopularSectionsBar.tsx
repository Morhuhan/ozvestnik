// app/(site)/components/PopularSectionsBar.tsx

"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

type Section = { id: string; slug: string; name: string; count: number };

export default function PopularSectionsBar({ sections }: { sections: Section[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measurerRef = useRef<HTMLDivElement | null>(null);
  const [visibleIdx, setVisibleIdx] = useState<number[]>([]);

  const items = useMemo(() => sections, [sections]);

  const recalc = () => {
    const container = containerRef.current;
    const measurer = measurerRef.current;
    if (!container || !measurer) return;

    const cs = getComputedStyle(container);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const borderX = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    const gap = parseFloat((cs.columnGap || cs.gap) || "8") || 8;

    const containerWidth = Math.max(
      0,
      Math.floor(container.getBoundingClientRect().width - padX - borderX)
    );

    const chips = Array.from(measurer.children) as HTMLElement[];
    const widths = chips.map((el) => Math.ceil(el.getBoundingClientRect().width));

    let used = 0;
    const picked: number[] = [];

    for (let i = 0; i < widths.length; i++) {
      const w = widths[i];

      // пропускаем слишком длинный чип, чтобы не ломал строку
      if (w > containerWidth) continue;

      const next = picked.length === 0 ? w : used + gap + w;
      if (next <= containerWidth) {
        used = next;
        picked.push(i);
      } else {
        // «дожим»: если совсем чуть-чуть не хватает, попробуем следующий короче
        continue;
      }
    }

    setVisibleIdx(picked);
  };

  useLayoutEffect(() => {
    recalc();
    const ro = new ResizeObserver(recalc);
    if (containerRef.current) ro.observe(containerRef.current);
    const onLoad = () => recalc();
    window.addEventListener("load", onLoad);
    window.addEventListener("orientationchange", recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener("load", onLoad);
      window.removeEventListener("orientationchange", recalc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-white/80 ring-1 ring-black/5 backdrop-blur">
      {/* измеритель вне потока */}
      <div ref={measurerRef} className="invisible absolute left-0 top-0 -z-10 flex gap-2 px-2 py-3">
        {items.map((s) => (
          <Chip key={`m-${s.id}`} name={s.name} slug={s.slug} />
        ))}
      </div>

      <div ref={containerRef} className="flex gap-2 px-2 py-3">
        {visibleIdx.map((i) => {
          const s = items[i];
          return <Chip key={s.id} name={s.name} slug={s.slug} />;
        })}
      </div>
    </div>
  );
}

function Chip({ name, slug }: { name: string; slug: string }) {
  return (
    <Link
      href={`/search?section=${encodeURIComponent(slug)}`}
      className="shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-3.5 py-1.5 text-sm font-medium text-neutral-700 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-200"
      title={name}
    >
      {name}
    </Link>
  );
}
