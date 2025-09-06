// app/components/CommentsForm.tsx

"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast/ToastProvider";
import { addComment } from "../actions/comments";

export function CommentsForm({
  articleId, slug, isLoggedIn, userName,
}: { articleId: string; slug: string; isLoggedIn: boolean; userName: string | null }) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onSubmit(formData: FormData) {
    const res = await addComment(formData);
    if (res.ok) {
      toast({ type: "success", title: "Комментарий отправлен" });
      formRef.current?.reset();
      router.refresh();
    } else {
      toast({ type: "error", title: "Не удалось отправить", description: res.error || "Попробуйте ещё раз" });
    }
  }

  return (
    <form ref={formRef} action={(fd) => startTransition(() => onSubmit(fd))} className="mt-4 space-y-3 rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
      <input type="hidden" name="articleId" value={articleId} />
      <input type="hidden" name="slug" value={slug} />
      <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />

      {isLoggedIn ? (
        <div className="text-sm text-neutral-800">
          Комментируете как <span className="font-medium">{userName ?? "Пользователь"}</span>.
          <span className="text-neutral-500"> Ваше имя видно другим пользователям.</span>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm">Ваше имя <span className="text-neutral-500">(публично)</span></label>
          <input
            name="guestName"
            className="w-full rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-500"
            placeholder="Например, Иван"
            maxLength={80}
            minLength={2}
            required
            disabled={pending}
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm">Комментарий</label>
        <textarea
          name="body"
          required
          minLength={1}
          maxLength={3000}
          className="h-28 w-full rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-500"
          placeholder="Напишите, что думаете…"
          disabled={pending}
        />
      </div>

      <button type="submit" disabled={pending} className="rounded-lg bg-neutral-900 px-4 py-2 text-white transition hover:bg-neutral-800 disabled:opacity-50">
        {pending ? "Отправка…" : "Отправить"}
      </button>

      <p className="text-xs text-neutral-600">Публикуя комментарий, вы соглашаетесь на отображение вашего имени рядом с комментарием.</p>
    </form>
  );
}
