'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    yaContextCb: Array<() => void>;
    Ya?: any;
    __ads?: { loaderReady: boolean; blocked: boolean };
  }
}

export default function YandexAdsProvider() {
  const [blocked, setBlocked] = useState(false);
  const baitRef = useRef<HTMLDivElement>(null);

  // Простая проверка adblock (многие блокируют .adsbox)
  useEffect(() => {
    const el = baitRef.current;
    if (!el) return;
    const check = () => {
      const style = getComputedStyle(el);
      const hidden =
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        el.offsetParent === null ||
        el.clientHeight === 0;
      if (hidden) {
        window.__ads = { ...(window.__ads ?? { loaderReady: false }), blocked: true };
        setBlocked(true);
      }
    };
    const t = setTimeout(check, 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: 'window.yaContextCb = window.yaContextCb || [];' }} />

      <Script
        id="yandex-rtb-loader"
        src="https://yandex.ru/ads/system/context.js"
        strategy="afterInteractive"
        async
        onLoad={() => {
          window.__ads = { ...(window.__ads ?? { blocked }), loaderReady: true };
          window.dispatchEvent(new Event('yandex-loader-ready'));
        }}
        onError={() => {
          window.__ads = { loaderReady: false, blocked: true };
          window.dispatchEvent(new Event('yandex-loader-error'));
          setBlocked(true);
        }}
      />

      {/* «Наживка» для детектора adblock */}
      <div
        ref={baitRef}
        className="adsbox"
        style={{ position: 'absolute', left: -9999, width: 1, height: 1 }}
        aria-hidden
      />
    </>
  );
}
