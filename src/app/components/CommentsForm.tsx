// app/components/CommentsForm.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FormToken = { issuedAt: number; sig: string | null; minAgeSec: number; ttlSec: number } | null;

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
  const [hp, setHp] = useState(""); // honeypot
  const [token, setToken] = useState<FormToken>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/comments/token");
        if (!res.ok) throw new Error("Не удалось получить токен формы");
        const t = await res.json();
        if (mounted) setToken(t);
      } catch {
        // оставим без токена -> сервер отклонит с понятным сообщением
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    if (!body.trim()) {
      setError("Введите текст комментария");
      return;
    }
    if (!token) {
      setError("Не удалось инициализировать форму. Обновите страницу.");
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
          hp,      // honeypot
          token,   // токен формы
          slug,
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
      if (data?.queued) {
        setInfo("Комментарий отправлен на модерацию.");
      } else {
        onSubmitted?.();
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
      {/* Honeypot: скрытое поле для ботов */}
      <div className="hidden" aria-hidden>
        <label>
          Ваш сайт
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
          />
        </label>
      </div>

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
      {info && <div className="mt-2 text-sm text-green-700">{info}</div>}

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !token}
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
