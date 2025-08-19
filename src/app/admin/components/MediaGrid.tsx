// src/app/admin/media/MediaGrid.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Asset = {
  id: string;
  kind: "IMAGE" | "VIDEO" | "OTHER";
  mime: string;
  filename: string;
  title: string | null;
  alt: string | null;
  createdAt: string | Date;
};

export default function MediaGrid({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Удалить файл безвозвратно?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/media/${id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as any));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e: any) {
      alert(`Ошибка удаления: ${e?.message || e}`);
    } finally {
      setBusyId(null);
    }
  }

  async function copyRelative(path: string) {
    try {
      await navigator.clipboard.writeText(path);
    } catch {}
  }

  async function copyAbsolute(path: string) {
    try {
      const abs = new URL(path, window.location.origin).toString();
      await navigator.clipboard.writeText(abs);
    } catch {}
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {assets.map((a) => {
        // ВАЖНО: у тебя роут сейчас /admin/media/[id]/raw
        const stablePath = `/admin/media/${a.id}/raw`;

        return (
          <div key={a.id} className="border rounded p-2 text-sm">
            <a
              href={stablePath} // всегда относительный → без гидрационных расхождений
              target="_blank"
              rel="noreferrer"
              className="block aspect-video bg-gray-50 rounded mb-2 overflow-hidden"
              title="Открыть в новой вкладке"
            >
              {a.kind === "IMAGE" ? (
                <img
                  src={stablePath}
                  alt={a.alt || a.title || a.filename}
                  className="object-cover w-full h-full"
                  loading="lazy"
                />
              ) : a.kind === "VIDEO" ? (
                <video
                  className="object-cover w-full h-full"
                  src={stablePath}
                  muted
                  controls
                  preload="metadata"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs opacity-70">
                  [{a.kind}] {a.mime}
                </div>
              )}
            </a>

            <div className="font-medium truncate" title={a.filename}>
              {a.filename}
            </div>
            <div className="opacity-60">{a.mime}</div>

            <div className="mt-2 space-y-1">
              <div className="flex gap-2">
                <input
                  readOnly
                  value={stablePath} // показываем относительный
                  className="w-full border rounded p-1 text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="px-2 py-1 border rounded text-xs"
                  onClick={() => copyRelative(stablePath)}
                  title="Скопировать относительную ссылку"
                >
                  Copy
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-2 py-1 border rounded text-xs w-full"
                  onClick={() => copyAbsolute(stablePath)}
                  title="Скопировать абсолютную ссылку"
                >
                  Copy absolute
                </button>
              </div>
            </div>

            <div className="mt-2 flex justify-between items-center">
              {/* suppressHydrationWarning — чтобы исключить возможный дрейф формата/таймзоны */}
              <span className="text-[10px] opacity-60" suppressHydrationWarning>
                {new Date(a.createdAt as any).toLocaleDateString("ru-RU")}
              </span>
              <button
                type="button"
                className="px-2 py-1 rounded text-xs bg-red-600 text-white disabled:opacity-60"
                onClick={() => handleDelete(a.id)}
                disabled={busyId === a.id}
              >
                {busyId === a.id ? "Удаляю…" : "Удалить"}
              </button>
            </div>
          </div>
        );
      })}
      {assets.length === 0 && (
        <div className="col-span-full text-center py-10 opacity-60">
          Пока нет файлов. Загрузите первый.
        </div>
      )}
    </div>
  );
}
