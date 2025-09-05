// src/app/news/[slug]/view-beacon.tsx
"use client";

import { useEffect, useRef } from "react";

export default function ViewBeacon({ articleId }: { articleId: string }) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current || !articleId) return;
    sentRef.current = true;

    const url = `/api/articles/${encodeURIComponent(articleId)}/view`;

    try {
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const blob = new Blob([JSON.stringify({})], { type: "application/json" });
        (navigator as any).sendBeacon(url, blob);
        return;
      }
    } catch {
    }

    fetch(url, { method: "POST", keepalive: true }).catch(() => {});
  }, [articleId]);

  return null;
}
