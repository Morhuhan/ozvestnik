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

function formatDateRU(d: string | Date) {
  const dt = new Date(d);
  return dt.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
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
      const res = await fetch(`/api/admin/media/${id}`, { method: "DELETE", cache: "no-store" });
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
        body: JSON.stringify({ title: form.title ?? "", alt: form.alt ?? "" }),
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

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      alert("Ссылка скопирована");
    } catch {
      alert("Не удалось скопировать ссылку");
    }
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-6">
      {assets.map((a) => {
        const stableUrl = `/admin/media/${a.id}/raw`;
        const isEditing = editId === a.id;

        return (
          <div
            key={a.id}
            className="group overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200 shadow-sm transition hover:shadow-md"
          >
            {/* Широкое превью */}
            <div className="relative aspect-[16/10] bg-neutral-100">
              {a.kind === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={stableUrl}
                  alt={a.alt || a.title || a.filename}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : a.kind === "VIDEO" ? (
                <video
                  src={stableUrl}
                  className="h-full w-full object-cover"
                  controls
                  preload="metadata"
                  playsInline
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-600">
                  [{a.kind}] {a.mime}
                </div>
              )}

              {!isEditing && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="m-3 rounded-xl bg-black/70 px-3 py-1.5 text-xs text-white">
                    {a.kind === "IMAGE" ? "Изображение" : a.kind === "VIDEO" ? "Видео" : "Файл"} · {formatDateRU(a.createdAt)}
                  </div>
                </div>
              )}
            </div>

            {/* Тело карточки */}
            <div className="p-5">
              {!isEditing ? (
                <>
                  <div className="min-h-[56px]">
                    <div
                      className="break-words text-[17px] font-semibold text-neutral-900"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                      title={a.title || a.filename}
                    >
                      {a.title || a.filename}
                    </div>
                    <div className="mt-1 break-all text-xs text-neutral-500">{a.mime}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-neutral-500">{formatDateRU(a.createdAt)}</span>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-3 text-center text-sm hover:bg-neutral-50"
                        onClick={() => copyLink(stableUrl)}
                        disabled={busyId === a.id}
                        title="Скопировать ссылку"
                      >
                        Скопировать
                      </button>
                      <a
                        href={stableUrl}
                        download
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-3 text-center text-sm hover:bg-neutral-50"
                        title="Скачать оригинал"
                      >
                        Скачать
                      </a>
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-3 text-center text-sm hover:bg-neutral-50"
                        onClick={() => startEdit(a)}
                        disabled={busyId === a.id}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-3 text-center text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
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
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-neutral-600">Заголовок (необязательно)</span>
                      <input
                        className="w-full rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-800"
                        value={form.title ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder={a.title ?? a.filename}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs text-neutral-600">Альт-текст (необязательно)</span>
                      <input
                        className="w-full rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-800"
                        value={form.alt ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, alt: e.target.value }))}
                        placeholder="Короткое описание изображения"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-center text-sm hover:bg-neutral-50"
                      onClick={cancelEdit}
                      disabled={busyId === a.id}
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-center text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
                      onClick={() => saveEdit(a.id)}
                      disabled={busyId === a.id}
                    >
                      Сохранить
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}

      {assets.length === 0 && (
        <div className="col-span-full rounded-2xl bg-neutral-50 py-14 text-center text-neutral-600 ring-1 ring-neutral-200">
          Пока нет файлов. Загрузите первый.
        </div>
      )}
    </div>
  );
}
