import { notFound } from "next/navigation";
import { prisma } from "../../../../../lib/db";
import { requireRole } from "../../../../../lib/session";
import { publishArticle, unpublishArticle, deleteArticle, updateArticle } from "../actions";
import { SectionPicker } from "../../components/SectionPicker";
import { TagPicker } from "../../components/TagPicker";
import { AuthorPicker } from "../../components/AuthorPicker";
import { TitleSlugSimple } from "../../components/TitleSlugSimple";
import { CreateTagButton } from "../../components/CreateTagButton";
import { CreateSectionButton } from "../../components/CreateSectionButton";
import { CreateAuthorButton } from "../../components/CreateAuthorButton";
import { MediaSinglePicker } from "../../components/MediaSinglePicker";
import { MediaMultiPicker } from "../../components/MediaMultiPicker";

function tiptapToPlain(content: any): string {
  const paras: string[] =
    content?.content?.map((p: any) => p?.content?.map((t: any) => t?.text || "").join("")) || [];
  return paras.join("\n\n");
}

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; field?: string }>;
}) {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const { id } = await params;
  const { error, field } = await searchParams;

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      coverMedia: { select: { id: true } },
      section: true,
      tags: { include: { tag: true } },
      authors: { include: { author: true }, orderBy: { order: "asc" } },
      media: { include: { media: true }, orderBy: { order: "asc" } },
    },
  });
  if (!article) notFound();

  const titleError = field === "title" ? error : undefined;
  const slugError = field === "slug" ? error : undefined;

  const bodyPlain = tiptapToPlain(article.content);
  const initialAuthors = article.authors.map((x) => x.author);
  const initialTags = article.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, slug: t.tag.slug }));
  const initialSection = article.section
    ? { id: article.section.id, name: article.section.name, slug: article.section.slug }
    : null;

  const coverMedia = article.coverMedia ?? null;
  const mainMedia = article.media.find((m) => m.role === "BODY")?.media || null;
  const galleryMedia = article.media.filter((m) => m.role === "GALLERY").map((m) => m.media);

  const onUpdate = updateArticle.bind(null, article.id);
  const onPublish = publishArticle.bind(null, article.id);
  const onUnpublish = unpublishArticle.bind(null, article.id);
  const onDelete = deleteArticle.bind(null, article.id);

  return (
    <div className="max-w-2xl space-y-6">
      <form action={onUpdate} className="space-y-5">
        <h1 className="text-2xl font-bold">Редактирование</h1>

        <TitleSlugSimple
          defaultTitle={article.title}
          defaultSlug={article.slug}
          titleError={titleError}
          slugError={slugError}
        />

        {/* Подзаголовок */}
        <label className="block">
          <div className="text-sm mb-1">Подзаголовок</div>
          <input
            name="subtitle"
            defaultValue={article.subtitle ?? ""}
            className="w-full border rounded p-2"
            placeholder="Подзаголовок"
          />
        </label>

        {/* Обложка */}
        <MediaSinglePicker
          name="cover"
          label="Обложка (для плитки / соцсетей)"
          acceptKinds={["IMAGE"]}
          defaultValue={coverMedia ? { id: coverMedia.id } : null}
        />

        {/* Главный медиа-блок */}
        <MediaSinglePicker
          name="main"
          label="Главный медиа-блок (фото/видео в начале)"
          acceptKinds={["IMAGE", "VIDEO"]}
          defaultValue={mainMedia ? { id: mainMedia.id } : null}
        />

        {/* Раздел */}
        <div className="flex items-center justify-between">
          <div className="text-sm mb-1">Раздел</div>
          <CreateSectionButton />
        </div>
        <SectionPicker name="section" initial={initialSection} />

        {/* Теги */}
        <div className="flex items-center justify-between">
          <div className="text-sm mb-1">Теги</div>
          <CreateTagButton />
        </div>
        <TagPicker name="tags" initial={initialTags} />

        {/* Авторы */}
        <div className="flex items-center justify-between">
          <div className="text-sm mb-1">Авторы</div>
          <CreateAuthorButton />
        </div>
        <AuthorPicker name="authors" initial={initialAuthors as any} />

        {/* Текст */}
        <label className="block">
          <div className="text-sm mb-1">Текст</div>
          <textarea
            name="body"
            defaultValue={bodyPlain}
            className="w-full border rounded p-2 h-60"
            placeholder="Текст"
          />
        </label>

        {/* Лента медиа */}
        <MediaMultiPicker
          name="gallery"
          label="Лента медиа (горизонтальная прокрутка)"
          initial={galleryMedia.map((m) => ({ id: m.id }))}
        />

        {/* 🔹 Комментарии — настройки */}
        <fieldset className="border rounded p-3 space-y-2">
          <legend className="text-sm font-medium px-1">Комментарии</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="commentsEnabled"
              defaultChecked={article.commentsEnabled}
            />
            Разрешить комментарии
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="commentsGuestsAllowed"
              defaultChecked={article.commentsGuestsAllowed}
            />
            Разрешить гостевые комментарии (без входа)
          </label>
        </fieldset>

        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-black text-white">Сохранить</button>
        </div>
      </form>

      <div className="flex gap-3">
        {article.status === "PUBLISHED" ? (
          <form action={onUnpublish}>
            <button className="px-4 py-2 rounded border">Снять с публикации</button>
          </form>
        ) : (
          <form action={onPublish}>
            <button className="px-4 py-2 rounded bg-green-600 text-white">Опубликовать</button>
          </form>
        )}
        <form action={onDelete}>
          <button className="px-4 py-2 rounded bg-red-600 text-white">Удалить</button>
        </form>
      </div>
    </div>
  );
}
