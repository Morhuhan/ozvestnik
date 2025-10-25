"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
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
    <button
      className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
      disabled={pending}
    >
      {pending ? "Сохраняю…" : "Сохранить черновик"}
    </button>
  );
}

type ClientField = "title" | "slug" | "subtitle" | "body" | "unknown";

export function NewArticleForm() {
  const [state, formAction] = useActionState<CreateArticleState, FormData>(
    createArticle,
    { ok: false }
  );

  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const lastErrorRef = useRef<string | undefined>(undefined);

  const field: ClientField = (state.field ?? "unknown") as ClientField;

  useEffect(() => {
    if (state.error && state.error !== lastErrorRef.current) {
      toast({ type: "error", title: state.error });
      lastErrorRef.current = state.error;
    }
  }, [state.error, toast]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const names: ClientField[] = ["title", "slug", "subtitle", "body", "unknown"];
    names.forEach((name) => {
      if (name === "unknown") return;
      const el =
        form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          `[name="${name}"]`
        );
      const on = field === name;
      if (el) {
        el.classList.toggle("border-red-500", on);
        el.classList.add("border");
        el.setAttribute("aria-invalid", on ? "true" : "false");
        if (on) el.focus();
      }
    });
  }, [field]);

  return (
    <form
      ref={formRef}
      id="new-article-form"
      action={formAction}
      className="max-w-2xl space-y-6"
      noValidate
    >
      <h1 className="text-2xl font-bold">Новая статья</h1>

      <TitleSlugSimple
        titleError={field === "title" ? state.error : undefined}
        slugError={field === "slug" ? state.error : undefined}
      />

      <label className="block">
        <div className="text-sm mb-1">Подзаголовок</div>
        <input
          name="subtitle"
          className="w-full border rounded p-2"
          placeholder="Подзаголовок (необязательно)"
          aria-describedby="subtitle-error"
        />
        {field === "subtitle" && state.error ? (
          <p id="subtitle-error" className="mt-1 text-sm text-red-600">
            {state.error}
          </p>
        ) : null}
      </label>

      <MediaSinglePicker
        name="cover"
        label="Обложка (для плитки / соцсетей)"
        acceptKinds={["IMAGE"]}
      />

      <MediaSinglePicker
        name="main"
        label="Главный медиа-блок (фото/видео в начале)"
        acceptKinds={["IMAGE", "VIDEO"]}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-sm mb-1">Раздел</div>
          <SectionPicker name="section" />
        </div>
        <div className="pt-6 pl-2">
          <CreateSectionButton />
        </div>
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-sm mb-1">Теги</div>
          <TagPicker name="tags" />
        </div>
        <div className="pt-6 pl-2">
          <CreateTagButton />
        </div>
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-sm mb-1">Авторы</div>
          <AuthorPicker name="authors" />
        </div>
        <div className="pt-6 pl-2">
          <CreateAuthorButton />
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm">Текст</div>
        <RichTextEditorModal jsonFieldName="contentJson" plainFieldName="body" />
        {field === "body" && state.error ? (
          <p className="text-sm text-red-600">{state.error}</p>
        ) : null}
      </div>

      <MediaMultiPicker
        name="gallery"
        label="Лента медиа (горизонтальная прокрутка)"
      />

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
