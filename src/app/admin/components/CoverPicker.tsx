// src/app/admin/components/CoverPicker.tsx
"use client";

import { useState } from "react";
import { useToast } from "@/app/components/toast/ToastProvider";

type MediaMeta = {
  id: string;
  kind: "IMAGE" | "VIDEO" | "OTHER";
  mime: string;
  title?: string | null;
  alt?: string | null;
  ext?: string | null;
};

async function fetchMeta(id: string): Promise<MediaMeta | null> {
  try {
    const res = await fetch(`/api/admin/media/${encodeURIComponent(id)}/meta`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as MediaMeta;
  } catch {
    return null;
  }
}

export function CoverPicker({
  articleId,
  initialUrl,
}: {
  articleId: string;
  initialUrl?: string | null;
}) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);

  async function onPickFromLibrary() {
    const assetId = prompt("ID ассета из Медиа (только изображение):");
    if (!assetId) return;

    // 1) Проверяем, что это IMAGE
    const meta = await fetchMeta(assetId.trim());
    if (!meta) {
      toast({
        type: "error",
        title: "Не удалось получить метаданные",
        description: "Проверьте ID ассета и попробуйте снова.",
      });
      return;
    }
    if (meta.kind !== "IMAGE") {
      toast({
        type: "error",
        title: "Нельзя выбрать это медиа",
        description: "В качестве обложки можно выбрать только изображение.",
      });
      return;
    }

    // 2) Стабильная ссылка на файл (API-роут)
    const stable = `/api/admin/media/${encodeURIComponent(assetId)}/raw`;

    // 3) Сообщаем серверу установить обложку
    const res = await fetch(
      `/api/admin/articles/${encodeURIComponent(articleId)}/set-cover`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ coverUrl: stable }),
      }
    );

    if (res.ok) {
      setUrl(stable);
      toast({ type: "success", title: "Обложка обновлена" });
    } else {
      const j = await res.json().catch(() => null);
      toast({
        type: "error",
        title: "Ошибка установки обложки",
        description: j?.error || `HTTP ${res.status}`,
      });
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-sm">Обложка</div>
      <div className="flex items-center gap-3">
        <div className="w-40 h-24 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="object-cover w-full h-full" />
          ) : (
            <span className="opacity-60 text-xs">Нет</span>
          )}
        </div>
        <button
          type="button"
          className="px-3 py-2 rounded border"
          onClick={onPickFromLibrary}
        >
          Выбрать из библиотеки
        </button>
      </div>
      {url && <input type="hidden" name="coverUrl" value={url} />}
    </div>
  );
}
