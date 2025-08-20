"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast/ToastProvider";
import { addComment } from "../actions/comments";

export function CommentsForm({
  articleId,
  slug,
  isLoggedIn,
  userName,
}: {
  articleId: string;
  slug: string;
  isLoggedIn: boolean;
  userName: string | null; // если авторизован — здесь ожидаем реальное имя
}) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onSubmit(formData: FormData) {
    const res = await addComment(formData);
    if (res.ok) {
      toast({ type: "success", title: "Комментарий отправлен" });
      formRef.current?.reset();
      router.refresh(); // подтянуть свежий список комментариев
    } else {
      toast({
        type: "error",
        title: "Не удалось отправить",
        description: res.error || "Попробуйте ещё раз",
      });
    }
  }

  return (
    <form
      ref={formRef}
      action={(fd) => startTransition(() => onSubmit(fd))}
      className="mt-4 space-y-3 border rounded p-4"
    >
      <input type="hidden" name="articleId" value={articleId} />
      <input type="hidden" name="slug" value={slug} />
      {/* ханипот для ботов */}
      <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />

      {isLoggedIn ? (
        // ✔️ Авторизован: показываем имя и НЕ рендерим поле ввода
        <div className="text-sm">
          Комментируете как <span className="font-medium">{userName ?? "Пользователь"}</span>.
          <span className="opacity-60"> Ваше имя видно другим пользователям.</span>
        </div>
      ) : (
        // Гость: просим имя (обязательно)
        <div>
          <label className="block text-sm mb-1">
            Ваше имя <span className="opacity-60">(публично)</span>
          </label>
          <input
            name="guestName"
            className="w-full border rounded px-3 py-2"
            placeholder="Например, Иван"
            maxLength={80}
            minLength={2}
            required
            disabled={pending}
          />
        </div>
      )}

      <div>
        <label className="block text-sm mb-1">Комментарий</label>
        <textarea
          name="body"
          required
          minLength={1}
          maxLength={3000}
          className="w-full border rounded px-3 py-2 h-28"
          placeholder="Напишите, что думаете…"
          disabled={pending}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50 hover:bg-gray-800"
      >
        {pending ? "Отправка…" : "Отправить"}
      </button>

      <p className="text-xs opacity-70">
        Публикуя комментарий, вы соглашаетесь на отображение вашего имени рядом с комментарием.
      </p>
    </form>
  );
}
