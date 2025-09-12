'use client';

import Script from 'next/script';

declare global {
  interface Window {
    yaContextCb: Array<() => void>;
  }
}

export default function YandexAdsProvider() {
  return (
    <>
      {/* Очередь колбэков Яндекса */}
      <script dangerouslySetInnerHTML={{ __html: 'window.yaContextCb = window.yaContextCb || [];' }} />
      {/* Загрузчик RTB. Подключаем ОДИН раз на странице */}
      <Script
        id="yandex-rtb-loader"
        src="https://yandex.ru/ads/system/context.js"
        strategy="afterInteractive"
        async
      />
    </>
  );
}
