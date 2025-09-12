'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ArticleTile, { type ArticleTileProps } from './ArticleTile';
import YandexAdSlot from './YandexAdSlot';

type FeedItem = ArticleTileProps;

type Props = {
  initialItems: FeedItem[];
  perPage: number;
  excludeIds?: string[];
  // Настройка частоты рекламы:
  firstAdAfter?: number;   // дефолт: 4
  adEvery?: number;        // дефолт: 8
  adMinHeight?: number;    // дефолт: 250
  adBlockId?: string;      // дефолт: 'R-A-17218944-1'
};

type Mixed =
  | { kind: 'article'; data: FeedItem }
  | { kind: 'ad'; key: string };

export default function InfiniteFeed({
  initialItems,
  perPage,
  excludeIds = [],
  firstAdAfter = 4,
  adEvery = 8,
  adMinHeight = 250,
  adBlockId = 'R-A-17218944-1',
}: Props) {
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [page, setPage] = useState(initialItems.length >= perPage ? 2 : 1);
  const [hasMore, setHasMore] = useState(initialItems.length >= perPage);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const seenIds = useMemo(() => new Set(initialItems.map((i) => i.id)), [initialItems]);
  const excludeParam = useMemo(
    () => (excludeIds.length > 0 ? excludeIds.join(',') : ''),
    [excludeIds]
  );

  // Формируем массив «карточки + рекламные слоты»
  const mixed: Mixed[] = useMemo(() => {
    const result: Mixed[] = [];
    let adCount = 0;

    items.forEach((it, idx) => {
      result.push({ kind: 'article', data: it });

      const pos = idx + 1;
      const shouldInsert =
        (pos === firstAdAfter) ||
        (pos > firstAdAfter && adEvery > 0 && (pos - firstAdAfter) % adEvery === 0);

      if (shouldInsert) {
        adCount += 1;
        result.push({ kind: 'ad', key: `ad-${adBlockId}-${adCount}` });
      }
    });

    return result;
  }, [items, firstAdAfter, adEvery, adBlockId]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const el = sentinelRef.current;

    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && !loading) {
          setLoading(true);
          const url = `/api/feed?page=${page}&limit=${perPage}${
            excludeParam ? `&exclude=${encodeURIComponent(excludeParam)}` : ''
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
      { rootMargin: '600px 0px 600px 0px' }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [page, perPage, hasMore, loading, excludeParam, seenIds]);

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {mixed.map((it) =>
          it.kind === 'article' ? (
            <ArticleTile key={it.data.id} {...it.data} />
          ) : (
            <div key={it.key} className="sm:col-span-2 lg:col-span-3">
              <YandexAdSlot
                blockId={adBlockId}
                type="feed"
                // уникальный id контейнера = ключу
                slotId={`yandex_${it.key}`}
                minHeight={adMinHeight}
              />
            </div>
          )
        )}
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
