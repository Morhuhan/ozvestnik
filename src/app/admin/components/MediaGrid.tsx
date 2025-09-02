// src/app/admin/media/components/MediaGrid.tsx
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

function formatDateUTC(d: string | Date) {
  const dt = new Date(d);
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = dt.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export default function MediaGrid({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<{ title?: string; alt?: string }>({});

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

  function startEdit(a: Asset) {
    setEditId(a.id);
    setForm({ title: a.title ?? "", alt: a.alt ?? "" });
  }

  function cancelEdit() {
    setEditId(null);
    setForm({});
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/media/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form), // только title и alt
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as any));
        throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
      }
      cancelEdit();
      router.refresh();
    } catch (e: any) {
      alert(`Не удалось сохранить: ${e?.message || e}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {assets.map((a) => {
        const stableUrl = `/admin/media/${a.id}/raw`;
        const isEditing = editId === a.id;

        return (
          <div key={a.id} className="border rounded p-2 text-sm">
            <div className="aspect-video bg-gray-50 rounded mb-2 overflow-hidden flex items-center justify-center">
              {a.kind === "IMAGE" ? (
                <img
                  src={stableUrl}
                  alt={a.alt || a.title || a.filename}
                  className="object-cover w-full h-full"
                  loading="lazy"
                />
              ) : a.kind === "VIDEO" ? (
                <video
                  src={stableUrl}
                  className="w-full h-full object-cover"
                  controls
                  preload="metadata"
                  playsInline
                />
              ) : (
                <div className="text-xs opacity-70">[{a.kind}] {a.mime}</div>
              )}
            </div>

            {!isEditing ? (
              <>
                <div className="font-medium truncate" title={a.title || a.filename}>
                  {a.title || a.filename}
                </div>
                <div className="opacity-60 truncate">{a.mime}</div>

                <div className="mt-2 flex justify-between items-center gap-2">
                  <span className="text-[10px] opacity-60">{formatDateUTC(a.createdAt)}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="px-2 py-1 rounded text-xs border hover:bg-gray-50"
                      onClick={() => startEdit(a)}
                      disabled={busyId === a.id}
                    >
                      Редактировать
                    </button>
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
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="block">
                    <span className="text-[11px] opacity-70">Title</span>
                    <input
                      className="w-full border rounded p-1"
                      value={form.title ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder={a.title ?? a.filename}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] opacity-70">Alt</span>
                    <input
                      className="w-full border rounded p-1"
                      value={form.alt ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, alt: e.target.value }))}
                      placeholder="Необязательно"
                    />
                  </label>
                </div>

                <div className="mt-2 flex justify-end gap-1">
                  <button
                    type="button"
                    className="px-2 py-1 rounded text-xs border"
                    onClick={cancelEdit}
                    disabled={busyId === a.id}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 rounded text-xs bg-black text-white disabled:opacity-60"
                    onClick={() => saveEdit(a.id)}
                    disabled={busyId === a.id}
                  >
                    Сохранить
                  </button>
                </div>
              </>
            )}
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
