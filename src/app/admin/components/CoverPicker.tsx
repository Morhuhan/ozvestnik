"use client";

import { useState } from "react";

export function CoverPicker({ articleId, initialUrl }: { articleId: string; initialUrl?: string | null }) {
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);

  async function onPickFromLibrary() {
    const assetId = prompt("ID ассета из Медиа:");
    if (!assetId) return;
    const stable = `/media/${assetId}/raw`;
    const res = await fetch(`/admin/articles/${articleId}/set-cover`, {
      method: "POST",
      body: new URLSearchParams({ coverUrl: stable })
    });
    if (res.ok) setUrl(stable);
    else alert("Ошибка установки обложки");
  }

  return (
    <div className="space-y-2">
      <div className="text-sm">Обложка</div>
      <div className="flex items-center gap-3">
        <div className="w-40 h-24 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
          {url ? <img src={url} className="object-cover w-full h-full" /> : <span className="opacity-60 text-xs">Нет</span>}
        </div>
        <button type="button" className="px-3 py-2 rounded border" onClick={onPickFromLibrary}>Выбрать из библиотеки</button>
      </div>
      {url && <input type="hidden" name="coverUrl" value={url} />}
    </div>
  );
}
