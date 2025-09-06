// app/components/CommentsForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CommentsForm({
  articleId,
  slug,
  isLoggedIn,
  userName,
  parentId = null,
  onSubmitted,
}: {
  articleId: string;
  slug: string;
  isLoggedIn: boolean;
  userName: string | null;
  parentId?: string | null;
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [guestName, setGuestName] = useState(userName ?? "");
  const [guestEmail, setGuestEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) {
      setError("Введите текст комментария");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          parentId,
          body,
          guestName: isLoggedIn ? undefined : guestName || undefined,
          guestEmail: isLoggedIn ? undefined : guestEmail || undefined,
          slug, // для post-redirect/логики (если нужно)
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Не удалось отправить комментарий");
      }
      setBody("");
      if (!isLoggedIn) {
        setGuestName("");
        setGuestEmail("");
      }
      onSubmitted?.();
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
      {parentId && (
        <div className="mb-2 text-xs text-neutral-600">
          Ответ на комментарий 
        </div>
      )}

      {!isLoggedIn && (
        <div className="mb-2 grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Ваше имя (необязательно)"
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-600"
          />
          <input
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            placeholder="Email (не публикуется)"
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Напишите комментарий…"
        rows={3}
        className="w-full resize-y rounded-md border border-neutral-300 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-600"
      />

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-9 items-center rounded-md bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {submitting ? "Отправка…" : "Отправить"}
        </button>
        {!isLoggedIn && (
          <div className="text-xs text-neutral-500">
            Отправляя комментарий, вы принимаете правила сайта.
          </div>
        )}
      </div>
    </form>
  );
}
