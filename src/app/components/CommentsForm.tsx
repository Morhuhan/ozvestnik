// app/components/CommentsForm.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FormToken = { issuedAt: number; sig: string | null; minAgeSec: number; ttlSec: number } | null;

const MIN_BODY_LENGTH = 3;
const MAX_BODY_LENGTH = 1000;
const MAX_NAME_LENGTH = 50;

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
  const [hp, setHp] = useState("");
  const [token, setToken] = useState<FormToken>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/comments/token");
        if (!res.ok) throw new Error("Не удалось получить токен формы");
        const t = await res.json();
        if (mounted) setToken(t);
      } catch {
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setCharCount(body.length);
  }, [body]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    setError(null);

    if (!body.trim()) {
      setError("Введите текст комментария");
      return;
    }
    if (body.length < MIN_BODY_LENGTH) {
      setError(`Комментарий должен содержать минимум ${MIN_BODY_LENGTH} символа.`);
      return;
    }
    if (body.length > MAX_BODY_LENGTH) {
      setError(`Комментарий не должен превышать ${MAX_BODY_LENGTH} символов.`);
      return;
    }

    if (!isLoggedIn) {
      if (guestName.length > MAX_NAME_LENGTH) {
        setError(`Имя не должно превышать ${MAX_NAME_LENGTH} символов.`);
        return;
      }
      if (guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
        setError("Введите корректный email адрес.");
        return;
      }
    }

    if (!token) {
      setError("Не удалось инициализировать форму. Обновите страницу.");
      return;
    }

    setSubmitting(true);
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
          hp,
          token,
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
            maxLength={MAX_NAME_LENGTH}
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
        maxLength={MAX_BODY_LENGTH}
        className="w-full resize-y rounded-md border border-neutral-300 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-600"
      />
      <div className="mt-1 text-xs text-right text-neutral-500">
        {charCount}/{MAX_BODY_LENGTH}
      </div>

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