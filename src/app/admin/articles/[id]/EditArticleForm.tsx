"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  type UpdateArticleState,
  updateArticle,
  updateAndPublishArticle,
} from "../actions";
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

type TagLite = { id: string; name: string; slug: string };
type SectionLite = { id: string; name: string; slug: string } | null;
type AuthorLite = { id: string; firstName: string; lastName: string; patronymic?: string | null };
type MediaLite = { id: string };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Сохраняю…" : "Сохранить"}
    </button>
  );
}

function PublishButton(props: { formAction: (formData: FormData) => void; confirmNeeded: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={props.formAction}
      onClick={(e) => {
        if (props.confirmNeeded) {
          const ok = window.confirm("У вас есть несохранённые изменения. Сохранить и опубликовать?");
          if (!ok) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }}
      className="px-6 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Публикую…" : "Опубликовать"}
    </button>
  );
}

export function EditArticleForm(props: {
  articleId: string;
  isPublished: boolean;
  initialTitle: string;
  initialSlug: string;
  initialSubtitle: string | null;
  initialSection: SectionLite;
  initialTags: TagLite[];
  initialAuthors: AuthorLite[];
  coverMedia: MediaLite | null;
  mainMedia: MediaLite | null;
  galleryMedia: MediaLite[];
  initialDoc: any;
  initialPlain: string;
  commentsEnabled: boolean;
  commentsGuestsAllowed: boolean;
  initialFontSize?: string;
  initialLineHeight?: string;
  initialParagraphSpacing?: string;
}) {
  const toast = useToast();

  const saveAction = updateArticle.bind(null, props.articleId);
  const [saveState, saveFormAction] = useActionState<UpdateArticleState, FormData>(saveAction, { ok: false });

  const publishAction = updateAndPublishArticle.bind(null, props.articleId);
  const [publishState, publishFormAction] = useActionState<UpdateArticleState, FormData>(publishAction, { ok: false });

  const formRef = useRef<HTMLFormElement>(null);
  const lastErrorRef = useRef<string | undefined>(undefined);
  const [dirty, setDirty] = useState(false);

  const activeError = publishState.error ?? saveState.error;
  const activeField = (publishState.field ?? saveState.field) as
    | "title"
    | "slug"
    | "subtitle"
    | "body"
    | "unknown"
    | undefined;

  useEffect(() => {
    if (activeError && activeError !== lastErrorRef.current) {
      toast({ type: "error", title: activeError });
      lastErrorRef.current = activeError;
    }
  }, [activeError, toast]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    (["title", "slug", "subtitle", "body"] as const).forEach((name) => {
      const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
      const on = activeField === name;
      if (el) {
        el.classList.toggle("border-red-500", on);
        el.classList.toggle("focus:ring-red-500", on);
        el.classList.add("border");
        el.setAttribute("aria-invalid", on ? "true" : "false");
        if (on) el.focus();
      }
    });
  }, [activeField]);

  return (
    <form
      ref={formRef}
      action={saveFormAction}
      className="space-y-6"
      onInput={() => setDirty(true)}
      onChange={() => setDirty(true)}
    >
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Редактирование статьи</h1>
          {props.isPublished && (
            <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
              Опубликовано
            </span>
          )}
        </div>

        <div className="space-y-6">
          <TitleSlugSimple
            defaultTitle={props.initialTitle}
            defaultSlug={props.initialSlug}
            titleError={undefined}
            slugError={undefined}
          />

          <div>
            <label htmlFor="subtitle" className="block text-sm font-medium text-gray-700 mb-2">
              Подзаголовок
            </label>
            <input
              id="subtitle"
              name="subtitle"
              defaultValue={props.initialSubtitle ?? ""}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              placeholder="Введите подзаголовок"
            />
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
            defaultValue={props.coverMedia ? { id: props.coverMedia.id } : null}
          />

          <MediaSinglePicker
            name="main"
            label="Главный медиа-блок (фото/видео в начале)"
            acceptKinds={["IMAGE", "VIDEO"]}
            defaultValue={props.mainMedia ? { id: props.mainMedia.id } : null}
          />

          <MediaMultiPicker
            name="gallery"
            label="Лента медиа (горизонтальная прокрутка)"
            initial={props.galleryMedia.map((m) => ({ id: m.id }))}
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
            <SectionPicker name="section" initial={props.initialSection} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Теги</label>
              <CreateTagButton />
            </div>
            <TagPicker name="tags" initial={props.initialTags} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Авторы</label>
              <CreateAuthorButton />
            </div>
            <AuthorPicker name="authors" initial={props.initialAuthors as any} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Контент статьи</h2>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Текст</label>
          <RichTextEditorModal
            initialDoc={props.initialDoc}
            initialPlain={props.initialPlain}
            jsonFieldName="contentJson"
            plainFieldName="body"
            initialFontSize={props.initialFontSize}
            initialLineHeight={props.initialLineHeight}
            initialParagraphSpacing={props.initialParagraphSpacing}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Настройки комментариев</h2>
        
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              name="commentsEnabled" 
              defaultChecked={props.commentsEnabled} 
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
              defaultChecked={props.commentsGuestsAllowed} 
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <SaveButton />
          {!props.isPublished && <PublishButton formAction={publishFormAction} confirmNeeded={dirty} />}
        </div>
        {dirty && (
          <p className="text-sm text-amber-600 mt-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Есть несохранённые изменения
          </p>
        )}
      </div>
    </form>
  );
}