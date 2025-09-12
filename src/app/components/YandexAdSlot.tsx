'use client';

import { useEffect, useId, useRef, useState } from 'react';

declare global {
  interface Window {
    yaContextCb: Array<() => void>;
    Ya?: any;
  }
}

type Props = {
  blockId: string;        // 'R-A-17218944-1'
  type?: 'feed' | 'floorAd' | 'fullscreen' | 'video' | string;
  slotId?: string;        // уникальный id контейнера (если нужно контролировать снаружи)
  minHeight?: number;     // чтобы верстка не "скакала"
};

export default function YandexAdSlot({
  blockId,
  type = 'feed',
  slotId,
  minHeight = 250,
}: Props) {
  const reactId = useId().replace(/:/g, '');
  const containerId = slotId ?? `yandex_rtb_${blockId.replace(/[^a-zA-Z0-9_-]/g, '')}_${reactId}`;
  const ref = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!ref.current || rendered) return;

    // Ленивая инициализация по IntersectionObserver
    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first.isIntersecting || rendered) return;

        // Кладем рендер в очередь yaContextCb — гарантирует, что скрипт уже загружен
        window.yaContextCb = window.yaContextCb || [];
        window.yaContextCb.push(function () {
          try {
            // @ts-ignore
            if (window.Ya?.Context?.AdvManager?.render) {
              // @ts-ignore
              window.Ya.Context.AdvManager.render({
                blockId,
                renderTo: containerId,
                type,
              });
              setRendered(true);
            }
          } catch {
            // молча, чтобы не ломать ленту
          }
        });

        io.disconnect();
      },
      { rootMargin: '600px 0px 600px 0px' }
    );

    io.observe(ref.current);
    return () => io.disconnect();
  }, [blockId, containerId, rendered, type]);

  return (
    <div
      id={containerId}
      ref={ref}
      style={{ minHeight }}
      className="w-full"
      aria-label="ad-slot"
    />
  );
}
