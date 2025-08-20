// src/app/admin/components/MediaMultiPicker.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../components/toast/ToastProvider";

type MediaKind = "IMAGE" | "VIDEO" | "OTHER";

type MediaMeta = {
  id: string;
  kind: MediaKind;
  mime: string;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  title?: string | null;
  alt?: string | null;
  ext?: string | null;
  filename?: string | null; // ⬅️ добавили
};

type MediaListItem = MediaMeta & {
  createdAt?: string | null;
};

type Value = { id: string }[];

async function fetchMeta(id: string, signal?: AbortSignal): Promise<MediaMeta> {
  const res = await fetch(`/api/admin/media/${id}/meta`, { cache: "no-store", signal });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as MediaMeta;
}

export function MediaMultiPicker({
  name,
  label = "Лента медиа",
  initial,
  acceptKinds,
}: {
  name: string;
  label?: string;
  initial?: Value;
  acceptKinds?: MediaKind[];
}) {
  const toast = useToast();
  const [items, setItems] = useState<Value>(initial ?? []);
  const [metas, setMetas] = useState<Record<string, MediaMeta | undefined>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────
  // MODAL state
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const debTimer = useRef<number | null>(null);

  const [list, setList] = useState<MediaListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const [pick, setPick] = useState<Set<string>>(new Set());
  const [kindFilter, setKindFilter] = useState<MediaKind | "ALL">(
    acceptKinds && acceptKinds.length === 1 ? acceptKinds[0] : "ALL"
  );

  // дебаунс для поиска
  useEffect(() => {
    if (debTimer.current) window.clearTimeout(debTimer.current);
    debTimer.current = window.setTimeout(() => {
      setQDeb(q.trim());
    }, 250);
    return () => {
      if (debTimer.current) window.clearTimeout(debTimer.current);
    };
  }, [q]);

  const kindsQuery = useMemo(() => {
    if (kindFilter !== "ALL") return kindFilter;
    if (acceptKinds && acceptKinds.length) return acceptKinds.join(",");
    return "";
  }, [kindFilter, acceptKinds]);

  // загрузка страницы списка медиа (для модалки)
  async function loadPage(p: number, append = false) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("limit", "40");
      if (qDeb) params.set("q", qDeb);
      if (kindsQuery) params.set("kinds", kindsQuery);

      const res = await fetch(`/api/admin/media?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const items: MediaListItem[] = data.items || [];
      setList((prev) => (append ? [...prev, ...items] : items));
      setHasMore(Boolean(data.hasMore));
      setPage(data.page || p);
    } catch (e: any) {
      toast({
        type: "error",
        title: "Не удалось загрузить медиатеку",
        description: e?.message || "Попробуйте позже",
      });
      setList([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    setOpen(true);
    setPick(new Set());
  }

  useEffect(() => {
    if (!open) return;
    setPage(1);
    loadPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, qDeb, kindsQuery]);

  function togglePick(id: string) {
    setPick((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // если уже есть в ленте — предупреждаем
  function handlePickClick(id: string) {
    const already = items.some((x) => x.id === id);
    if (already) {
      toast({
        type: "error",
        title: "Медиа уже добавлено",
        description: "Этот элемент уже есть в ленте",
      });
      return;
    }
    togglePick(id);
  }

  function addPickedToList() {
    if (pick.size === 0) {
      setOpen(false);
      return;
    }
    let added = 0;
    let skipped = 0;
    setItems((prev) => {
      const exist = new Set(prev.map((x) => x.id));
      const toAdd: Value = [];
      for (const id of pick) {
        if (exist.has(id)) skipped++;
        else {
          toAdd.push({ id });
          added++;
        }
      }
      return [...prev, ...toAdd];
    });
    if (added > 0) toast({ type: "success", title: `Добавлено: ${added}` });
    if (skipped > 0) toast({ type: "info", title: `Пропущено (дубликаты): ${skipped}` });
    setOpen(false);
  }

  // ─────────────────────────────────────────────────────────────
  // превью и управление текущим списком

  const stableList = useMemo(() => items.map((it) => it.id), [items]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setError(null);
      const missing = stableList.filter((id) => metas[id] === undefined);
      if (missing.length === 0) return;

      try {
        for (const id of missing) {
          setBusy((b) => ({ ...b, [id]: true }));
          const meta = await fetchMeta(id, controller.signal);
          if (!cancelled) {
            setMetas((m) => ({ ...m, [id]: meta }));
            setBusy((b) => {
              const { [id]: _, ...rest } = b;
              return rest;
            });
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || String(e));
          toast({
            type: "error",
            title: "Не удалось загрузить превью",
            description: e?.message || "Попробуйте обновить страницу",
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableList.join("|")]);

  function removeId(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
    toast({ type: "info", title: "Удалено из ленты" });
  }

  function move(id: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx < 0) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = prev.slice();
      const [el] = copy.splice(idx, 1);
      copy.splice(j, 0, el);
      return copy;
    });
  }

  function renderCard(id: string) {
    const m = metas[id];
    const isVideo = m?.kind === "VIDEO" || (m?.mime ? m.mime.startsWith("video/") : false);
    const loadingItem = busy[id] && !m;

    return (
      <div key={id} className="relative shrink-0 w-56">
        <div className="aspect-video bg-gray-50 rounded overflow-hidden flex items-center justify-center">
          {!m && loadingItem ? (
            <div className="text-xs opacity-60">Загрузка…</div>
          ) : !m && error ? (
            <div className="text-xs text-red-600">Ошибка</div>
          ) : isVideo ? (
            <video
              src={`/admin/media/${id}/raw`}
              controls
              preload="metadata"
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={`/admin/media/${id}/raw`}
              alt={m?.alt || m?.title || m?.filename || id}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}
        </div>

        {/* название / подпись */}
        <div className="mt-1 text-[11px] truncate">
          {m?.title || m?.alt || m?.filename || id}
        </div>

        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            className="px-2 py-1 border rounded text-xs"
            onClick={() => move(id, -1)}
            title="Влево"
          >
            ←
          </button>
          <button
            type="button"
            className="px-2 py-1 border rounded text-xs"
            onClick={() => move(id, +1)}
            title="Вправо"
          >
            →
          </button>
          <button
            type="button"
            className="ml-auto px-2 py-1 bg-red-600 text-white rounded text-xs"
            onClick={() => removeId(id)}
            title="Удалить из ленты"
          >
            Удалить
          </button>
        </div>

        {m?.mime && <div className="mt-1 text-[10px] opacity-60 truncate">{m.mime}</div>}
      </div>
    );
  }

  const hiddenValue = useMemo(() => JSON.stringify(items), [items]);

  // ─────────────────────────────────────────────────────────────
  // UI

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openModal}
            className="px-2 py-1 border rounded text-xs"
            aria-label="Открыть библиотеку"
          >
            Открыть библиотеку
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-3 py-1">{stableList.map(renderCard)}</div>
      </div>

      <input type="hidden" name={name} value={hiddenValue} />

      {/* ───────────── MODAL ───────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-xl shadow w-full max-w-4xl p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Выбрать медиа</div>
              <button type="button" onClick={() => setOpen(false)} className="text-xl leading-none">
                ×
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск по имени, заголовку или MIME"
                className="flex-1 border rounded p-2"
              />
              <div className="flex items-center gap-2 text-sm">
                <span className="opacity-70">Тип:</span>
                <select
                  className="border rounded p-2"
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value as MediaKind | "ALL")}
                >
                  {(!acceptKinds || acceptKinds.length > 1) && <option value="ALL">Все</option>}
                  {(acceptKinds ?? ["IMAGE", "VIDEO", "OTHER"]).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border rounded max-h-[60vh] overflow-auto p-2">
              {loading && list.length === 0 ? (
                <div className="p-3 text-sm opacity-60">Загрузка…</div>
              ) : list.length === 0 ? (
                <div className="p-3 text-sm opacity-60">Ничего не найдено</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {list.map((m) => {
                    const isVideo =
                      m.kind === "VIDEO" || (m.mime ? m.mime.toLowerCase().startsWith("video/") : false);
                    const checked = pick.has(m.id);
                    const already = items.some((x) => x.id === m.id);

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handlePickClick(m.id)}
                        className={`relative border rounded overflow-hidden text-left group ${
                          checked ? "ring-2 ring-blue-500" : ""
                        } ${already ? "opacity-70" : ""}`}
                        title={m.filename || m.title || m.id}
                      >
                        <div className="aspect-video bg-gray-50 flex items-center justify-center">
                          {isVideo ? (
                            <video
                              src={`/admin/media/${m.id}/raw`}
                              preload="metadata"
                              playsInline
                              muted
                              className="w-full h-full object-cover pointer-events-none"
                            />
                          ) : (
                            <img
                              src={`/admin/media/${m.id}/raw`}
                              alt={m.alt || m.title || m.filename || m.id}
                              className="w-full h-full object-cover pointer-events-none"
                              loading="lazy"
                            />
                          )}
                        </div>
                        <div className="p-2 text-xs truncate">
                          {m.title || m.filename || m.id}
                        </div>
                        <div className="absolute top-2 left-2">
                          <input type="checkbox" readOnly checked={checked} />
                        </div>
                        {already && (
                          <div className="absolute bottom-1 left-1 right-1 text-[10px] px-1 py-0.5 rounded bg-white/80">
                            Уже в ленте
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {hasMore && (
                <div className="flex justify-center mt-3">
                  <button
                    type="button"
                    className="px-3 py-1.5 border rounded text-sm"
                    onClick={() => loadPage(page + 1, true)}
                    disabled={loading}
                  >
                    {loading ? "Загрузка…" : "Ещё"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-2 rounded border" onClick={() => setOpen(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
                onClick={addPickedToList}
                disabled={pick.size === 0}
              >
                Добавить выбранные
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
