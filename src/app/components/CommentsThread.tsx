// app/components/CommentsThread.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CommentsForm } from "./CommentsForm";
import { useRouter } from "next/navigation";
import Avatar from "./Avatar";

function formatDateISO(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

export type UiComment = {
  id: string;
  body: string;
  createdAt: string; // ISO
  parentId: string | null;
  author: { id: string; name: string | null; image: string | null } | null;
  guestName: string | null;
};

type TreeNode = UiComment & { children: TreeNode[] };

function buildTree(rows: UiComment[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function CommentsThread({
  comments,
  canReply,
  canModerate,
  articleId,
  slug,
  isLoggedIn,
  userName,
}: {
  comments: UiComment[];
  canReply: boolean;
  canModerate: boolean;
  articleId: string;
  slug: string;
  isLoggedIn: boolean;
  userName: string | null;
}) {
  const router = useRouter();
  const tree = useMemo(() => buildTree(comments), [comments]);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function doDelete(id: string) {
    if (!canModerate) return;
    const ok = window.confirm(
      "Удалить комментарий и все его ответы? Действие необратимо в интерфейсе."
    );
    if (!ok) return;
    try {
      setBusyId(id);
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Не удалось удалить");
      }
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Ошибка удаления");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {tree.map((c) => (
        <div key={c.id} className="flex gap-4">
          <Avatar src={c.author?.image} size={64} />

          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              {c.author ? (
                <Link
                  href={`/u/${c.author.id}`}
                  className="underline decoration-dotted underline-offset-2"
                  title="Открыть профиль"
                >
                  {c.author.name || "Пользователь"}
                </Link>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ring-1 ring-neutral-300">
                    Гость
                  </span>
                  <span>{c.guestName || "аноним"}</span>
                </>
              )}
            </div>
            <div className="text-xs text-neutral-500">{formatDateISO(c.createdAt)}</div>
            <div className="mt-1 whitespace-pre-wrap leading-relaxed">{c.body}</div>

            <div className="mt-2 flex items-center gap-4">
              {canReply ? (
                <button
                  type="button"
                  onClick={() => setOpenFor((prev) => (prev === c.id ? null : c.id))}
                  className="text-xs text-blue-700 underline underline-offset-2"
                >
                  {openFor === c.id ? "Отменить ответ" : "Ответить"}
                </button>
              ) : null}

              {canModerate ? (
                <button
                  type="button"
                  onClick={() => doDelete(c.id)}
                  disabled={busyId === c.id}
                  className="text-xs text-red-700 underline underline-offset-2 disabled:opacity-60"
                  title="Удалить комментарий и ветку"
                >
                  {busyId === c.id ? "Удаление…" : "Удалить"}
                </button>
              ) : null}
            </div>

            {openFor === c.id && (
              <div className="mt-3">
                <CommentsForm
                  articleId={articleId}
                  slug={slug}
                  isLoggedIn={isLoggedIn}
                  userName={userName}
                  parentId={c.id}
                  onSubmitted={() => {
                    setOpenFor(null);
                    router.refresh();
                  }}
                />
              </div>
            )}

            {c.children.length > 0 && (
              <div className="mt-4 space-y-4 pl-6 border-l border-neutral-200">
                {c.children.map((r) => (
                  <div key={r.id} className="flex gap-3">
                    <Avatar src={r.author?.image} size={64} />

                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {r.author ? (
                          <Link
                            href={`/u/${r.author.id}`}
                            className="underline decoration-dotted underline-offset-2"
                            title="Открыть профиль"
                          >
                            {r.author.name || "Пользователь"}
                          </Link>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] ring-1 ring-neutral-300">
                              Гость
                            </span>
                            <span>{r.guestName || "аноним"}</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500">{formatDateISO(r.createdAt)}</div>
                      <div className="mt-1 whitespace-pre-wrap leading-relaxed">{r.body}</div>

                      {canModerate && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => doDelete(r.id)}
                            disabled={busyId === r.id}
                            className="text-xs text-red-700 underline underline-offset-2 disabled:opacity-60"
                            title="Удалить комментарий и ветку"
                          >
                            {busyId === r.id ? "Удаление…" : "Удалить"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
