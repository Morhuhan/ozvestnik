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
      className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
      const on = field === name;
      if (el) {
        el.classList.toggle("border-red-500", on);
        el.classList.toggle("focus:ring-red-500", on);
        el.classList.add("border");
        el.setAttribute("aria-invalid", on ? "true" : "false");
        if (on) el.focus();
      }
    });
  }, [field]);

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <form
        ref={formRef}
        id="new-article-form"
        action={formAction}
        className="max-w-4xl mx-auto space-y-6"
        noValidate
      >
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Новая статья</h1>

          <div className="space-y-6">
            <TitleSlugSimple
              titleError={field === "title" ? state.error : undefined}
              slugError={field === "slug" ? state.error : undefined}
            />

            <div>
              <label htmlFor="subtitle" className="block text-sm font-medium text-gray-700 mb-2">
                Подзаголовок
              </label>
              <input
                id="subtitle"
                name="subtitle"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                placeholder="Введите подзаголовок (необязательно)"
                aria-describedby="subtitle-error"
              />
              {field === "subtitle" && state.error ? (
                <p id="subtitle-error" className="mt-2 text-sm text-red-600">
                  {state.error}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Медиа-контент</h2>
          
          <div className="space-y-6">
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

            <MediaMultiPicker
              name="gallery"
              label="Лента медиа (горизонтальная прокрутка)"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Категории и метаданные</h2>
          
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Раздел</label>
                <CreateSectionButton />
              </div>
              <SectionPicker name="section" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Теги</label>
                <CreateTagButton />
              </div>
              <TagPicker name="tags" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Авторы</label>
                <CreateAuthorButton />
              </div>
              <AuthorPicker name="authors" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Контент статьи</h2>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Текст</label>
            <RichTextEditorModal jsonFieldName="contentJson" plainFieldName="body" />
            {field === "body" && state.error ? (
              <p className="text-sm text-red-600 mt-2">{state.error}</p>
            ) : null}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Настройки комментариев</h2>
          
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                name="commentsEnabled" 
                defaultChecked 
                className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Разрешить комментарии
                </span>
              </div>
            </label>
            
            <label className="flex items-start gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                name="commentsGuestsAllowed" 
                defaultChecked 
                className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Разрешить гостевые комментарии
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  Пользователи смогут комментировать без авторизации
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}