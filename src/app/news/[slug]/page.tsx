// src/app/news/[slug]/page.tsx
export const dynamic = "force-dynamic";

import { generateHTML } from "@tiptap/html/server";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import sanitizeHtml, { defaults as sanitizeDefaults, IOptions } from "sanitize-html";
import CommentsSection from "@/app/components/CommentsSection";
import LightboxGallery, { GalleryItem } from "@/app/components/LightboxGallery";
import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/session";

// ─────────────────────────────────────────────────────────────────────────────
// TipTap JSON -> безопасный HTML (без дубликатов экстеншенов)
// ─────────────────────────────────────────────────────────────────────────────
function renderContentHTML(content: any) {
  const exts = [
    StarterKit.configure({
      // те же выключения, что и в админке
      strike: false,
      code: false,
      codeBlock: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      horizontalRule: false,
      // Настраиваем link здесь, чтобы не подключать @tiptap/extension-link ещё раз
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        // HTML-атрибуты для рендеринга ссылок
        HTMLAttributes: {
          class: "text-blue-600 underline cursor-pointer",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      },
      // underline уже внутри StarterKit — отдельного импорта не требуется
    }),
    Image.configure({
      allowBase64: false,
      inline: false, // блочные изображения
    }),
  ];

  const html = generateHTML(
    content ?? { type: "doc", content: [{ type: "paragraph" }] },
    exts
  );

  const options: IOptions = {
    allowedTags: sanitizeDefaults.allowedTags.concat(["img", "figure", "figcaption"]),
    allowedAttributes: {
      a: ["href", "target", "rel", "class"],
      img: [
        "src",
        "alt",
        "title",
        "width",
        "height",
        "loading",
        "decoding",
        "data-media-id",
        "data-captionized",
        "class",
      ],
      figure: ["class"],
      figcaption: ["class"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: true,
  };

  return sanitizeHtml(html, options);
}

// ─────────────────────────────────────────────────────────────────────────────
// Инъекция подписей: ищем id по data-media-id или по src="/admin/media/{id}/raw"
// Оборачиваем <img> в <figure><figcaption>, экранируем текст подписи
// ─────────────────────────────────────────────────────────────────────────────
function injectImageCaptions(
  html: string,
  mediaById: Map<string, { title?: string | null }>
) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return html.replace(/<img\b([^>]*?)\/?>/gi, (full, attrs: string) => {
    // уже обработано
    if (/\sdata-captionized\s*=\s*"/i.test(attrs)) return full;

    // 1) data-media-id
    let id: string | null = null;
    const mData = attrs.match(/\sdata-media-id\s*=\s*"([^"]+)"/i);
    if (mData) id = mData[1];

    // 2) src с нашим стабильным роутом
    if (!id) {
      const mSrc = attrs.match(/\ssrc\s*=\s*"([^"]+)"/i);
      if (mSrc) {
        const mId = mSrc[1].match(/\/admin\/media\/([^/]+)\/raw/i);
        if (mId) id = mId[1];
      }
    }

    if (!id) return full;

    const title = mediaById.get(id)?.title?.trim();
    if (!title) return full;

    const attrsWithMark = attrs.replace(/\s+$/, "") + ' data-captionized="1"';
    return `<figure class="media-figure"><img${attrsWithMark}><figcaption class="media-caption">${esc(
      title
    )}</figcaption></figure>`;
  });
}

function formatDate(d: Date) {
  return new Date(d).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

export default async function ArticlePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  const a = await prisma.article.findUnique({
    where: { slug },
    include: {
      section: true,
      tags: { include: { tag: true } },
      authors: { include: { author: true }, orderBy: { order: "asc" } },
      coverMedia: true,
      media: { include: { media: true }, orderBy: { order: "asc" } },
    },
  });

  if (!a || a.status !== "PUBLISHED") notFound();

  const [{ commentsEnabled, commentsGuestsAllowed }, sessionUser] = await Promise.all([
    prisma.article.findUniqueOrThrow({
      where: { id: a.id },
      select: { commentsEnabled: true, commentsGuestsAllowed: true },
    }),
    getSessionUser(),
  ]);
  const isLoggedIn = Boolean(sessionUser?.id);

  const mainMedia = a.media.find((m) => m.role === "BODY")?.media || null;
  const galleryMedia = a.media.filter((m) => m.role === "GALLERY").map((m) => m.media);
  const coverId = a.coverMedia?.id;

  const authorsFio = a.authors.length
    ? a.authors
        .map((x) => [x.author.lastName, x.author.firstName, x.author.patronymic].filter(Boolean).join(" "))
        .join(", ")
    : "—";

  const mediaUrl = (id: string) => `/admin/media/${id}/raw`;
  const isVideo = (mime?: string | null) => typeof mime === "string" && mime.toLowerCase().startsWith("video/");

  // Карта медиа для подстановки подписей
  const mediaById = new Map<string, { title?: string | null }>();
  for (const m of a.media) mediaById.set(m.media.id, { title: m.media.title });

  // HTML из TipTap + подписи под img (если есть title)
  const articleHtmlRaw = renderContentHTML(a.content);
  const articleHtml = injectImageCaptions(articleHtmlRaw, mediaById);

  const formDisabledForViewer = !commentsEnabled || (!commentsGuestsAllowed && !isLoggedIn);
  let readOnlyComments:
    | Array<{
        id: string;
        body: string;
        createdAt: Date;
        author: { id: string; name: string | null; image: string | null } | null;
        guestName: string | null;
      }>
    | null = null;

  if (formDisabledForViewer) {
    const cs = await prisma.comment.findMany({
      where: { articleId: a.id, status: "PUBLISHED" },
      include: { author: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: "asc" },
    });
    readOnlyComments = cs.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: c.author ? { id: c.author.id, name: c.author.name, image: c.author.image } : null,
      guestName: c.guestName ?? null,
    }));
  }

  // Элементы для лайтбокса ленты
  const galleryItems: GalleryItem[] = galleryMedia.map((m) => ({
    id: m.id,
    url: mediaUrl(m.id),
    title: m.title ?? undefined,
    isVideo: isVideo(m.mime),
  }));

  return (
    <article className="container mx-auto p-4 max-w-3xl">
      {/* Небольшой CSS-тюнинг для картинок и подписей */}
      <style>{`
        .prose img {
          border-radius: 0.5rem;
          margin: 1rem auto;
          height: auto;
        }
        .media-figure {
          margin: 1rem 0;
          text-align: center;
        }
        .media-caption {
          font-size: 12px;
          opacity: 0.7;
          margin-top: 0.35rem;
        }
      `}</style>

      {/* Верхняя служебная строка */}
      <div className="text-sm opacity-70">
        {a.section?.name ?? "Без раздела"} • {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("ru-RU") : ""}
      </div>

      {/* Заголовок и подзаголовок */}
      <h1 className="text-3xl font-bold mt-2">{a.title}</h1>
      {a.subtitle && <p className="mt-2 text-neutral-700">{a.subtitle}</p>}

      {/* Главный медиа-блок */}
      {mainMedia && (
        <div className="mt-6 rounded overflow-hidden">
          <div className="aspect-video bg-black">
            {isVideo(mainMedia.mime) ? (
              <video
                src={mediaUrl(mainMedia.id)}
                controls
                preload="metadata"
                playsInline
                className="w-full h-full object-contain bg-black"
                poster={coverId ? mediaUrl(coverId) : undefined}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl(mainMedia.id)}
                alt={mainMedia.alt || mainMedia.title || a.title}
                className="w-full h-full object-cover"
                loading="eager"
              />
            )}
          </div>
          {(mainMedia.title || mainMedia.caption) && (
            <div className="text-xs opacity-70 mt-2 text-center">
              {mainMedia.title || mainMedia.caption}
            </div>
          )}
        </div>
      )}

      {/* Текст статьи — с изображениями и подписями */}
      <div
        className="prose prose-lg max-w-none mt-6"
        dangerouslySetInnerHTML={{ __html: articleHtml }}
      />

      {/* Галерея / лента (с лайтбоксом) */}
      {galleryItems.length > 0 && (
        <section className="mt-8">
          <div className="text-sm font-medium mb-2">Медиа</div>
          <LightboxGallery items={galleryItems} />
        </section>
      )}

      {/* Автор(ы) и теги */}
      <div className="mt-8 border-t pt-6 text-sm opacity-80">Автор(ы): {authorsFio}</div>

      {a.tags.length > 0 && (
        <div className="mt-3 text-sm flex фwrap gap-2">
          {a.tags.map((t) => (
            <a
              key={t.tagId}
              className="px-2 py-1 rounded border text-xs hover:bg-gray-50"
              href={`/tag/${encodeURIComponent(t.tag.slug)}`}
            >
              #{t.tag.name}
            </a>
          ))}
        </div>
      )}

      {/* ───────────── СЕКЦИЯ КОММЕНТАРИЕВ ───────────── */}
      {formDisabledForViewer ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Комментарии</h2>
          <div className="mt-3 text-sm p-3 border rounded bg-gray-50">
            {!commentsEnabled
              ? "Комментарии к этой статье отключены."
              : "Комментировать могут только авторизованные пользователи."}{" "}
            {!isLoggedIn && commentsEnabled && (
              <>
                <a className="underline" href="/api/auth/signin">
                  Войти
                </a>
                .
              </>
            )}
          </div>

          {/* Read-only список */}
          <div className="mt-6 space-y-4">
            {(!readOnlyComments || readOnlyComments.length === 0) ? (
              <div className="text-sm opacity-70">Комментариев нет.</div>
            ) : (
              readOnlyComments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-lg overflow-hidden">
                    {c.author?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.author.image} alt="" className="h-9 w-9 object-cover" />
                    ) : c.author ? (
                      <span>🙂</span>
                    ) : (
                      <span title="Гость">👤</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {c.author ? (
                        <a
                          href={`/u/${c.author.id}`}
                          className="underline decoration-dotted underline-offset-2"
                          title="Открыть профиль"
                        >
                          {c.author.name || "Пользователь"}
                        </a>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 border">Гость</span>
                          <span>{c.guestName || "аноним"}</span>
                        </>
                      )}
                    </div>
                    <div className="text-xs opacity-60">{formatDate(c.createdAt)}</div>
                    <div className="mt-1 whitespace-pre-wrap leading-relaxed">{c.body}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : (
        <CommentsSection articleId={a.id} slug={a.slug} />
      )}
    </article>
  );
}
