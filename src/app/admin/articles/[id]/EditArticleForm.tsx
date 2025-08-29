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
    <button className="px-4 py-2 rounded bg-black text-white" disabled={pending}>
      {pending ? "Сохраняю…" : "Сохранить"}
    </button>
  );
}

function PublishButton(props: {
  formAction: (formData: FormData) => void;
  confirmNeeded: boolean;
}) {
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
      className="px-4 py-2 rounded bg-green-600 text-white"
      disabled={pending}
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
}) {
  const toast = useToast();

  // Основной экшен "Сохранить"
  const saveAction = updateArticle.bind(null, props.articleId);
  const [saveState, saveFormAction] = useActionState<UpdateArticleState, FormData>(
    saveAction,
    { ok: false }
  );

  // Экшен "Сохранить и опубликовать"
  const publishAction = updateAndPublishArticle.bind(null, props.articleId);
  const [publishState, publishFormAction] = useActionState<UpdateArticleState, FormData>(
    publishAction,
    { ok: false }
  );

  const formRef = useRef<HTMLFormElement>(null);
  const lastErrorRef = useRef<string | undefined>(undefined);
  const [dirty, setDirty] = useState(false);

  // Любая серверная ошибка → тост (текст в форме не показываем)
  const activeError = publishState.error ?? saveState.error;
  const activeField = publishState.field ?? saveState.field;

  useEffect(() => {
    if (activeError && activeError !== lastErrorRef.current) {
      toast({ type: "error", title: activeError });
      lastErrorRef.current = activeError;
    }
  }, [activeError, toast]);

  // Подсветка проблемного поля
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    (["title", "slug", "body"] as const).forEach((name) => {
      const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
      const on = activeField === name;
      if (el) {
        el.classList.toggle("border-red-500", on);
        el.classList.add("border");
        el.setAttribute("aria-invalid", on ? "true" : "false");
      }
    });
  }, [activeField]);

  return (
    <form
      ref={formRef}
      action={saveFormAction}
      className="space-y-5"
      onInput={() => setDirty(true)}
      onChange={() => setDirty(true)}
    >
      <h1 className="text-2xl font-bold">Редактирование</h1>

      <TitleSlugSimple
        defaultTitle={props.initialTitle}
        defaultSlug={props.initialSlug}
        titleError={undefined}
        slugError={undefined}
      />

      {/* Подзаголовок */}
      <label className="block">
        <div className="text-sm mb-1">Подзаголовок</div>
        <input
          name="subtitle"
          defaultValue={props.initialSubtitle ?? ""}
          className="w-full border rounded p-2"
          placeholder="Подзаголовок"
        />
      </label>

      {/* Обложка */}
      <MediaSinglePicker
        name="cover"
        label="Обложка (для плитки / соцсетей)"
        acceptKinds={["IMAGE"]}
        defaultValue={props.coverMedia ? { id: props.coverMedia.id } : null}
      />

      {/* Главный медиа-блок */}
      <MediaSinglePicker
        name="main"
        label="Главный медиа-блок (фото/видео в начале)"
        acceptKinds={["IMAGE", "VIDEO"]}
        defaultValue={props.mainMedia ? { id: props.mainMedia.id } : null}
      />

      {/* Раздел */}
      <div className="flex items-center justify-between">
        <div className="text-sm mb-1">Раздел</div>
        <CreateSectionButton />
      </div>
      <SectionPicker name="section" initial={props.initialSection} />

      {/* Теги */}
      <div className="flex items-center justify-between">
        <div className="text-sm mb-1">Теги</div>
        <CreateTagButton />
      </div>
      <TagPicker name="tags" initial={props.initialTags} />

      {/* Авторы */}
      <div className="flex items-center justify-between">
        <div className="text-sm mb-1">Авторы</div>
        <CreateAuthorButton />
      </div>
      <AuthorPicker name="authors" initial={props.initialAuthors as any} />

      {/* Текст */}
      <div className="space-y-2">
        <div className="text-sm">Текст</div>
        <RichTextEditorModal
          initialDoc={props.initialDoc}
          initialPlain={props.initialPlain}
          jsonFieldName="contentJson"
          plainFieldName="body"
        />
      </div>

      {/* Лента медиа */}
      <MediaMultiPicker
        name="gallery"
        label="Лента медиа (горизонтальная прокрутка)"
        initial={props.galleryMedia.map((m) => ({ id: m.id }))}
      />

      {/* Настройки комментариев */}
      <fieldset className="border rounded p-3 space-y-2">
        <legend className="text-sm font-medium px-1">Комментарии</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="commentsEnabled" defaultChecked={props.commentsEnabled} />
          Разрешить комментарии
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="commentsGuestsAllowed" defaultChecked={props.commentsGuestsAllowed} />
          Разрешить гостевые комментарии (без входа)
        </label>
      </fieldset>

      <div className="flex gap-2">
        <SaveButton />
        {!props.isPublished && (
          <PublishButton formAction={publishFormAction} confirmNeeded={dirty} />
        )}
      </div>
    </form>
  );
}
