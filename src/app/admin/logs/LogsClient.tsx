"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AuditItem = {
  id: string;
  ts: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  detail: any;
  actor: { id: string; name: string | null; email: string | null } | null;
  article: { id: string; title: string; slug: string } | null;
};

function formatRU(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "medium" });
}

function SnapshotTree({ comments }: { comments: any[] }) {
  const byId: Map<string, (any & { children: any[] })> = new Map();
  comments.forEach((c) => byId.set(c.id, { ...c, children: [] }));

  const roots: any[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const Node = ({ n }: { n: any }) => (
    <li className="mb-3">
      <div className="rounded-xl bg-white ring-1 ring-neutral-200 p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-neutral-600">
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 ring-1 ring-neutral-200">
            {new Date(n.createdAt).toLocaleString("ru-RU")}
          </span>
          {n.isGuest ? (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 ring-1 ring-neutral-200">
              Гость{n.guestName ? `: ${n.guestName}` : ""}
            </span>
          ) : (
            <a className="underline decoration-dotted underline-offset-2" href={`/u/${n.authorId}`}>
              {n.authorName || n.authorEmail || n.authorId}
            </a>
          )}
          <span className="text-neutral-400">({n.id})</span>
        </div>
        <div className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-900">{n.body}</div>
      </div>
      {n.children?.length > 0 && (
        <ul className="ml-4 mt-2 border-l pl-3">
          {n.children.map((c: any) => (
            <Node key={c.id} n={c} />
          ))}
        </ul>
      )}
    </li>
  );

  return <ul>{roots.map((r) => <Node key={r.id} n={r} />)}</ul>;
}

function badgeClasses(action: string): string {
  switch (action) {
    case "COMMENT_CREATE":
      return "bg-blue-50 text-blue-800 ring-blue-200";
    case "COMMENT_DELETE":
      return "bg-red-50 text-red-800 ring-red-200";
    case "USER_REGISTER":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "USER_BAN":
    case "GUEST_BAN":
      return "bg-orange-50 text-orange-800 ring-orange-200";
    case "USER_UNBAN":
    case "GUEST_UNBAN":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    default:
      return "bg-neutral-100 text-neutral-800 ring-neutral-200";
  }
}

export default function LogsClient({
  initial,
  live = true,
  fetchQuery = "",
}: {
  initial: AuditItem[];
  live?: boolean;
  fetchQuery?: string;
}) {
  const [items, setItems] = useState<AuditItem[]>(initial);
  const newestTs = useMemo(() => (items.length ? items[0].ts : new Date(0).toISOString()), [items]);

  useEffect(() => {
    if (!live) return;
    let intervalId: number | null = null;
    let timeoutId: number | null = null;

    async function tick() {
      try {
        const url =
          `/api/admin/logs${fetchQuery ? `${fetchQuery}&` : "?"}after=${encodeURIComponent(newestTs)}&take=200`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const fresh: AuditItem[] = data?.items ?? [];
        if (fresh.length) {
          const seen = new Set<string>(items.map((i) => i.id));
          const merged = [...fresh.filter((f) => !seen.has(f.id)), ...items];
          setItems(merged.slice(0, 500));
        }
      } catch {
        /* no-op */
      }
    }
    timeoutId = window.setTimeout(tick, 1000);
    intervalId = window.setInterval(tick, 5000);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newestTs, live, fetchQuery, items]);

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-2xl bg-neutral-50 p-5 text-[15px] text-neutral-700 ring-1 ring-neutral-200">
          Ничего не найдено.
        </div>
      ) : (
        items.map((r) => (
          <details
            key={r.id}
            className="group rounded-2xl bg-white ring-1 ring-neutral-200 shadow-sm open:ring-neutral-300 open:shadow-md"
          >
            <summary className="flex cursor-pointer items-baseline gap-4 px-5 py-3 hover:bg-neutral-50 rounded-2xl">
              <span className="w-[190px] shrink-0 text-[12px] text-neutral-600">{formatRU(r.ts)}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ring-1 ${badgeClasses(r.action)}`}>
                {r.action}
              </span>

              <span className="truncate text-[15px] leading-6 text-neutral-900">
                {r.article ? (
                  <>
                    <a
                      href={`/news/${encodeURIComponent(r.article.slug)}`}
                      className="font-semibold underline decoration-dotted underline-offset-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.article.title}
                    </a>
                    {r.summary ? (
                      <>
                        {" "}
                        — <span className="text-neutral-700">{r.summary}</span>
                      </>
                    ) : null}
                  </>
                ) : (
                  r.summary
                )}
              </span>
            </summary>

            <div className="px-6 pb-6">
              <div className="mb-3 grid grid-cols-[160px_1fr] gap-2 text-[14px]">
                <div className="text-neutral-500">Действие</div>
                <div className="text-neutral-900">{r.action}</div>

                <div className="text-neutral-500">Цель</div>
                <div className="text-neutral-900">
                  {r.article ? (
                    <a
                      href={`/news/${encodeURIComponent(r.article.slug)}`}
                      className="font-medium underline decoration-dotted underline-offset-2"
                    >
                      {r.article.title}
                    </a>
                  ) : (
                    <span className="text-neutral-700">{r.summary}</span>
                  )}
                </div>

                <div className="text-neutral-500">Инициатор</div>
                <div className="text-neutral-900">
                  {r.actor ? (
                    <>
                      <a className="underline" href={`/u/${r.actor.id}`}>
                        {r.actor.name || r.actor.email || r.actor.id}
                      </a>
                      <span className="ml-2 text-neutral-500">({r.actor.id})</span>
                    </>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </div>
              </div>

              {r.action === "COMMENT_CREATE" && r.detail?.body ? (
                <div className="mb-4 rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <div className="mb-1 text-xs font-semibold text-neutral-700">Комментарий</div>
                  <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-900">{r.detail.body}</div>
                  <div className="mt-2 text-xs text-neutral-500">
                    commentId={r.detail.commentId}
                    {r.detail.parentId ? ` • ответ на ${r.detail.parentId}` : ""}
                  </div>
                </div>
              ) : null}

              {r.action === "COMMENT_DELETE" && r.detail?.comments?.length ? (
                <div className="mb-4 rounded-xl bg-red-50 p-4 ring-1 ring-red-100">
                  <div className="mb-2 text-sm font-semibold text-red-800">
                    Содержимое удалённой ветки ({r.detail.deletedCount})
                  </div>
                  <SnapshotTree comments={r.detail.comments} />
                </div>
              ) : null}

              <div className="rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                <div className="mb-1 text-xs font-semibold text-neutral-600">Детали (JSON)</div>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-[12px] leading-relaxed">
{JSON.stringify(r.detail ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        ))
      )}
    </div>
  );
}
