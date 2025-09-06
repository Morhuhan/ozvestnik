// app/(site)/components/InfiniteFeed.tsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ArticleTile, { type ArticleTileProps } from "./ArticleTile";

type FeedItem = ArticleTileProps;

type Props = {
  initialItems: FeedItem[];
  perPage: number;
  excludeIds?: string[];
};

export default function InfiniteFeed({
  initialItems,
  perPage,
  excludeIds = [],
}: Props) {
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [page, setPage] = useState(initialItems.length >= perPage ? 2 : 1);
  const [hasMore, setHasMore] = useState(initialItems.length >= perPage);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const seenIds = useMemo(() => new Set(initialItems.map((i) => i.id)), [initialItems]);
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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <ArticleTile key={it.id} {...it} />
        ))}
      </div>

      <div ref={sentinelRef} className="h-12 w-full" />

      {loading && (
        <div className="mt-4 flex items-center justify-center text-sm text-neutral-600">
          Загрузка…
        </div>
      )}
    </>
  );
}
