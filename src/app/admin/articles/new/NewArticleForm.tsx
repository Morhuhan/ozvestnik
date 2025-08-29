// src/app/admin/articles/new/NewArticleForm.tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useEffect, useRef } from "react";
import { createArticle, type CreateArticleState } from "../actions";
import { TitleSlugSimple } from "../../components/TitleSlugSimple";
import { CreateTagButton } from "../../components/CreateTagButton";
import { CreateSectionButton } from "../../components/CreateSectionButton";
import { CreateAuthorButton } from "../../components/CreateAuthorButton";
import { TagPicker } from "../../components/TagPicker";
import { AuthorPicker } from "../../components/AuthorPicker";
import { SectionPicker } from "../../components/SectionPicker";
import { MediaSinglePicker } from "../../components/MediaSinglePicker";
import { MediaMultiPicker } from "../../components/MediaMultiPicker";
import { RichTextEditorModal } from "../../components/RichTextEditorModal";
import { useToast } from "@/app/components/toast/ToastProvider";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="px-4 py-2 rounded bg-black text-white" disabled={pending}>
      {pending ? "Сохраняю…" : "Сохранить черновик"}
    </button>
  );
}

export function NewArticleForm() {
  const [state, formAction] = useActionState<CreateArticleState, FormData>(
    createArticle,
    { ok: false }
  );
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const lastErrorRef = useRef<string | undefined>(undefined);

  // 1) Тостим серверные ошибки (без редиректа)
  useEffect(() => {
    if (state.error && state.error !== lastErrorRef.current) {
      toast({ type: "error", title: state.error });
      lastErrorRef.current = state.error;
    }
  }, [state.error, toast]);

  // 2) Подсвечиваем только проблемное поле (без текстов ошибок)
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const names = ["title", "slug", "body"] as const;

    names.forEach((name) => {
      const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[name="${name}"]`
      );
      const on = state.field === name;
      if (el) {
        el.classList.toggle("border-red-500", on);
        el.classList.add("border"); // чтобы рамка точно была
        el.setAttribute("aria-invalid", on ? "true" : "false");
      }
    });
  }, [state.field]);

  return (
    <form ref={formRef} id="new-article-form" action={formAction} className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Новая статья</h1>

      {/* Важно: не прокидываем текст ошибок внутрь, чтобы не показывать их в форме */}
      <TitleSlugSimple titleError={undefined} slugError={undefined} />

      {/* УБРАНЫ любые <div data-field-error=...> с текстами ошибок */}

      {/* Подзаголовок */}
      <label className="block">
        <div className="text-sm mb-1">Подзаголовок</div>
        <input
          name="subtitle"
          className="w-full border rounded p-2"
          placeholder="Подзаголовок (необязательно)"
        />
      </label>

      {/* Обложка */}
      <MediaSinglePicker
        name="cover"
        label="Обложка (для плитки / соцсетей)"
        acceptKinds={["IMAGE"]}
      />

      {/* Главный медиа-блок */}
      <MediaSinglePicker
        name="main"
        label="Главный медиа-блок (фото/видео в начале)"
        acceptKinds={["IMAGE", "VIDEO"]}
      />

      {/* Раздел */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-sm mb-1">Раздел</div>
          <SectionPicker name="section" />
        </div>
        <div className="pt-6 pl-2"><CreateSectionButton /></div>
      </div>

      {/* Теги */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-sm mb-1">Теги</div>
          <TagPicker name="tags" />
        </div>
        <div className="pt-6 pl-2"><CreateTagButton /></div>
      </div>

      {/* Авторы */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-sm mb-1">Авторы</div>
          <AuthorPicker name="authors" />
        </div>
        <div className="pt-6 pl-2"><CreateAuthorButton /></div>
      </div>

      {/* Текст */}
      <div className="space-y-2">
        <div className="text-sm">Текст</div>
        <RichTextEditorModal jsonFieldName="contentJson" plainFieldName="body" />
        {/* Без текстов ошибок — подсветка пойдёт по [name="body"] */}
      </div>

      {/* Лента/галерея */}
      <MediaMultiPicker name="gallery" label="Лента медиа (горизонтальная прокрутка)" />

      {/* Комментарии */}
      <fieldset className="border rounded p-3 space-y-2">
        <legend className="text-sm font-medium px-1">Комментарии</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="commentsEnabled" defaultChecked />
          Разрешить комментарии
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="commentsGuestsAllowed" defaultChecked />
          Разрешить гостевые комментарии (без входа)
        </label>
      </fieldset>

      <div className="flex gap-2">
        <SubmitButton />
      </div>
    </form>
  );
}
