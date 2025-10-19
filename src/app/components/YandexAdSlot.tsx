"use client";

import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    yaContextCb: Array<() => void>;
    Ya?: any;
    __ads?: { loaderReady: boolean; blocked: boolean };
  }
}

type Props = {
  blockId: string;
  type?: "feed" | string;
  slotId?: string;
  minHeight?: number;
  timeoutMs?: number;
  className?: string;
};

export default function YandexAdSlot({
  blockId,
  type = "feed",
  slotId,
  minHeight = 280,
  timeoutMs = 2500,
  className,
}: Props) {
  const reactId = useId().replace(/:/g, "");
  const containerId = slotId ?? `yandex_rtb_${blockId.replace(/[^a-zA-Z0-9_-]/g, "")}_${reactId}`;
  const ref = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<"idle" | "rendering" | "rendered" | "blocked" | "timeout">("idle");

  const hasIframe = () => !!ref.current?.querySelector("iframe");

  useEffect(() => {
    const start = () => {
      setState("rendering");

      window.yaContextCb = window.yaContextCb || [];
      window.yaContextCb.push(() => {
        try {
          if (window.Ya?.Context?.AdvManager?.render) {
            window.Ya.Context.AdvManager.render({ blockId, renderTo: containerId, type });
          } else {
            setState("timeout");
          }
        } catch {
          setState("timeout");
        }
      });

      const t = window.setTimeout(() => {
        if (!hasIframe()) setState("timeout");
      }, timeoutMs);

      const mo = new MutationObserver(() => {
        if (hasIframe()) {
          setState("rendered");
          window.clearTimeout(t);
          mo.disconnect();
        }
      });
      if (ref.current) mo.observe(ref.current, { childList: true, subtree: true });

      return () => {
        window.clearTimeout(t);
        mo.disconnect();
      };
    };

    const global = window.__ads ?? { loaderReady: false, blocked: false };
    if (global.blocked) {
      setState("blocked");
      return;
    }

    if (global.loaderReady) {
      start();
      return;
    }

    const onReady = () => start();
    const onErr = () => setState("blocked");
    window.addEventListener("yandex-loader-ready", onReady);
    window.addEventListener("yandex-loader-error", onErr);

    const safety = window.setTimeout(() => {
      if (!(window.__ads?.loaderReady)) setState("blocked");
    }, 2000);

    return () => {
      window.removeEventListener("yandex-loader-ready", onReady);
      window.removeEventListener("yandex-loader-error", onErr);
      window.clearTimeout(safety);
    };
  }, [blockId, containerId, timeoutMs, type]);

  if (state === "idle" || state === "blocked" || state === "timeout") {
    return null;
  }

  return (
    <div id={containerId} ref={ref} className={`w-full ${className ?? ""}`} style={{ minHeight }} />
  );
}
