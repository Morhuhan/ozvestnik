// src/app/admin/components/MediaSinglePicker.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

export type MediaKind = "IMAGE" | "VIDEO" | "OTHER";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  mime: string;
  filename: string;
  title: string | null;
  alt: string | null;
  createdAt: string | Date;
};

type Props = {
  name: string;
  label?: string;
  /** какие типы разрешены выбирать из библиотеки */
  acceptKinds?: MediaKind[];
  /** начальное значение (например при редактировании статьи) */
  defaultValue?: { id: string } | null;
  /** уведомляет родителя о смене выбранного медиа (или о снятии выбора) */
  onChange?: (item: MediaItem | null) => void;
};

const displayName = (m: Pick<MediaItem, "id" | "title" | "filename">) =>
  m.title || m.filename || m.id;

const displayAlt = (m: Pick<MediaItem, "id" | "title" | "filename" | "alt">) =>
  m.alt || m.title || m.filename || m.id;

export function MediaSinglePicker({
  name,
  label,
  acceptKinds,
  defaultValue = null,
  onChange,
}: Props) {
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [open, setOpen] = useState(false);

  // Подтягиваем метаданные, если пришёл только id
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!defaultValue?.id) {
        setSelected(null);
        onChange?.(null);
        return;
      }
      try {
        const res = await fetch(`/api/admin/media/${defaultValue.id}/meta`, { cache: "no-store" });
        if (!res.ok) return;
        const meta = await res.json();
        const item: MediaItem = {
          id: defaultValue.id,
          kind: meta.kind || "OTHER",
          mime: meta.mime || "application/octet-stream",
          filename: meta.filename || defaultValue.id,
          title: meta.title ?? null,
          alt: meta.alt ?? null,
          createdAt: meta.createdAt || new Date().toISOString(),
        };
        if (!ignore) {
          setSelected(item);
          onChange?.(item);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue?.id]);

  const hiddenValue = useMemo(
    () => (selected ? JSON.stringify({ id: selected.id }) : ""),
    [selected]
  );

  const stableUrl = useMemo(
    () => (selected ? `/admin/media/${selected.id}/raw` : ""),
    [selected]
  );

  const clear = () => {
    setSelected(null);
    onChange?.(null);
  };

  return (
    <div className="space-y-2">
      {label && <div className="text-sm font-medium">{label}</div>}

      {/* скрытое поле, которое уходит в форму */}
      <input type="hidden" name={name} value={hiddenValue} />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="px-2 py-1 border rounded text-sm"
          onClick={() => setOpen(true)}
        >
          Открыть библиотеку
        </button>
        <button
          type="button"
          className="text-xs underline opacity-80 disabled:opacity-40"
          onClick={clear}
          disabled={!selected}
        >
          Очистить
        </button>
      </div>

      {/* превью выбранного элемента */}
      <div className="aspect-video bg-gray-50 rounded overflow-hidden border flex items-center justify-center">
        {selected ? (
          selected.kind === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stableUrl}
              alt={displayAlt(selected)}
              className="object-cover w-full h-full"
            />
          ) : selected.kind === "VIDEO" ? (
            <video
              src={stableUrl}
              className="w-full h-full object-contain bg-black"
              controls
              preload="metadata"
            />
          ) : (
            <div className="p-3 text-xs opacity-70 text-center">
              [{selected.kind}] {selected.mime}
            </div>
          )
        ) : (
          <div className="text-sm opacity-60">Ничего не выбрано</div>
        )}
      </div>

      {/* подпись выбранного медиа — title → filename → id */}
      {selected && (
        <div className="text-xs opacity-80 truncate">
          {displayName(selected)}
        </div>
      )}

      {open && (
        <LibraryModal
          onClose={() => setOpen(false)}
          onPick={(item) => {
            setSelected(item);
            onChange?.(item);
            setOpen(false);
          }}
          acceptKinds={acceptKinds}
          // если уже выбран — подсветим внутри модалки
          currentId={selected?.id ?? null}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────  МОДАЛКА БИБЛИОТЕКИ  ───────────────────────────── */

function LibraryModal({
  onClose,
  onPick,
  acceptKinds,
  currentId,
}: {
  onClose: () => void;
  onPick: (item: MediaItem) => void;
  acceptKinds?: MediaKind[];
  currentId: string | null;
}) {
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [kinds, setKinds] = useState<MediaKind[]>(
    acceptKinds && acceptKinds.length > 0 ? acceptKinds : ["IMAGE", "VIDEO", "OTHER"]
  );
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // дебаунс поиска
  useEffect(() => {
    const id = setTimeout(() => setQDeb(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  // загрузка страницы библиотеки
  async function load(reset: boolean) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(reset ? 1 : page));
      params.set("limit", "40");
      if (qDeb) params.set("q", qDeb);
      if (kinds.length && kinds.length < 3) params.set("kinds", kinds.join(","));

      // GET /api/admin/media?page=1&limit=40&kinds=IMAGE,VIDEO&q=...
      const res = await fetch(`/api/admin/media?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      const list: MediaItem[] = (data.items || []).map((x: any) => ({
        id: x.id,
        kind: x.kind,
        mime: x.mime,
        filename: x.filename,
        title: x.title ?? null,
        alt: x.alt ?? null,
        createdAt: x.createdAt,
      }));
      setItems((prev) => (reset ? list : [...prev, ...list]));
      setHasMore(Boolean(data.hasMore) || (list.length > 0 && list.length === 40));
      setPage((p) => (reset ? 2 : p + 1));
    } catch {
      if (reset) {
        setItems([]);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  }

  // первая загрузка и перезагрузки при изменении фильтров
  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDeb, kinds.join(",")]);

  const toggleKind = (k: MediaKind) => {
    if (acceptKinds && !acceptKinds.includes(k)) return; // запрещено внешним фильтром
    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-xl shadow w-full max-w-5xl p-4 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="text-lg font-medium">Библиотека медиа</div>
          <button type="button" onClick={onClose} className="text-xl leading-none">
            ×
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по имени, mime…"
            className="w-full md:flex-1 border rounded p-2"
          />
          {/* Переключатели типов, только если не зафиксированы acceptKinds одним значением */}
          <div className="flex items-center gap-2">
            {(["IMAGE", "VIDEO", "OTHER"] as MediaKind[])
              .filter((k) => !acceptKinds || acceptKinds.includes(k))
              .map((k) => (
                <label key={k} className="text-sm inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={kinds.includes(k)}
                    onChange={() => toggleKind(k)}
                  />
                  {k}
                </label>
              ))}
          </div>
        </div>

        <div className="border rounded max-h-[65vh] overflow-auto p-2">
          {loading && items.length === 0 ? (
            <div className="p-3 text-sm opacity-60">Загрузка…</div>
          ) : items.length === 0 ? (
            <div className="p-3 text-sm opacity-60">Ничего не найдено</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {items.map((m) => {
                const href = `/admin/media/${m.id}/raw`;
                const isActive = currentId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`border rounded overflow-hidden text-left group ${
                      isActive ? "ring-2 ring-blue-500" : ""
                    }`}
                    onClick={() => onPick(m)}
                    title={displayName(m)}
                  >
                    <div className="aspect-video bg-gray-50 flex items-center justify-center overflow-hidden">
                      {m.kind === "IMAGE" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={href}
                          alt={displayAlt(m)}
                          className="object-cover w-full h-full"
                        />
                      ) : m.kind === "VIDEO" ? (
                        <video
                          src={href}
                          className="w-full h-full object-contain bg-black"
                          muted
                          preload="metadata"
                        />
                      ) : (
                        <div className="p-2 text-xs opacity-70 text-center">
                          [{m.kind}] {m.mime}
                        </div>
                      )}
                    </div>
                    {/* подпись — title → filename → id */}
                    <div className="p-2 text-xs truncate">{displayName(m)}</div>
                  </button>
                );
              })}
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center p-3">
              <button
                type="button"
                onClick={() => load(false)}
                className="px-3 py-1 border rounded text-sm"
                disabled={loading}
              >
                {loading ? "Загрузка…" : "Ещё"}
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="px-3 py-2 rounded border" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
