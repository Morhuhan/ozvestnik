"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ArticleTile, { type ArticleTileProps } from "./ArticleTile";

type FeedItem = ArticleTileProps;

type Props = {
  initialItems: FeedItem[];
  perPage: number;
  /** опционально: ids, которые надо исключить (для совместимости со старым кодом) */
  excludeIds?: string[];
};

export default function InfiniteFeed({
  initialItems,
  perPage,
  excludeIds = [], // ⬅️ дефолт
}: Props) {
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  // стартовая страница: если уже отдали perPage — начинаем со 2, иначе дальше не грузим
  const [page, setPage] = useState(initialItems.length >= perPage ? 2 : 1);
  const [hasMore, setHasMore] = useState(initialItems.length >= perPage);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // set для дедупликации id
  const seenIds = useMemo(() => new Set(initialItems.map((i) => i.id)), [initialItems]);

  // безопасно формируем строку исключений (или пустую строку)
  const excludeParam = useMemo(
    () => (excludeIds.length > 0 ? excludeIds.join(",") : ""),
    [excludeIds]
  );

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const el = sentinelRef.current;

    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && !loading) {
          setLoading(true);
          const url = `/api/feed?page=${page}&limit=${perPage}${
            excludeParam ? `&exclude=${encodeURIComponent(excludeParam)}` : ""
          }`;
          fetch(url)
            .then((r) => r.json())
            .then((data: { items: FeedItem[]; hasMore: boolean; nextPage: number }) => {
              // фильтруем уже встречавшиеся id
              const fresh = data.items.filter((it) => !seenIds.has(it.id));
              fresh.forEach((it) => seenIds.add(it.id));
              if (fresh.length > 0) setItems((prev) => [...prev, ...fresh]);

              setHasMore(data.hasMore);
              setPage(data.nextPage);
            })
            .finally(() => setLoading(false));
        }
      },
      { rootMargin: "600px 0px 600px 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [page, perPage, hasMore, loading, excludeParam, seenIds]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <ArticleTile key={it.id} {...it} />
        ))}
      </div>

      <div ref={sentinelRef} className="h-12 w-full" />

      {loading && (
        <div className="mt-4 flex items-center justify-center text-sm text-neutral-500">
          Загрузка…
        </div>
      )}
    </>
  );

}
