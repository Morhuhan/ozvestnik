// src/app/news/[slug]/page.tsx
export const dynamic = "force-dynamic";

import { generateHTML } from "@tiptap/html/server";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import DOMPurify from "isomorphic-dompurify";
import CommentsSection from "@/app/components/CommentsSection";
import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/session";

// Рендер TipTap JSON -> безопасный HTML (с поддержкой ссылок и картинок)
function renderContentHTML(content: any) {
  const html = generateHTML(
    content ?? { type: "doc", content: [{ type: "paragraph" }] },
    [
      StarterKit.configure({
        // те же выключения, что и в админке
        strike: false,
        code: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ["http", "https", "mailto", "tel"],
        defaultProtocol: "https",
        HTMLAttributes: {
          class: "text-blue-600 underline cursor-pointer",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Image.configure({
        allowBase64: false,
        inline: false, // как в редакторе — блочные изображения
      }),
    ],
  );

  // Разрешаем безопасные классы/атрибуты на <a> и <img>, включая data-media-id
  const safe = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: [
      "class",
      "target",
      "rel",
      "data-media-id",
      "alt",
      "title",
      "width",
      "height",
      "loading",
      "decoding",
    ],
  });

  return safe;
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

  // HTML из TipTap с поддержкой <img>
  const articleHtml = renderContentHTML(a.content);

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

  return (
    <article className="container mx-auto p-4 max-w-3xl">
      {/* Небольшой CSS-тюнинг для картинок внутри статьи */}
      <style>{`
        .prose img {
          border-radius: 0.5rem;
          margin: 1rem auto;
          height: auto;
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
          {mainMedia.caption && <div className="text-xs opacity-70 mt-2">{mainMedia.caption}</div>}
        </div>
      )}

      {/* Текст статьи — с изображениями и ссылками */}
      <div
        className="prose prose-lg max-w-none mt-6"
        dangerouslySetInnerHTML={{ __html: articleHtml }}
      />

      {/* Галерея / лента */}
      {galleryMedia.length > 0 && (
        <section className="mt-8">
          <div className="text-sm font-medium mb-2">Медиа</div>
          <div className="overflow-x-auto">
            <div className="flex gap-3 py-1">
              {galleryMedia.map((m) => (
                <div key={m.id} className="shrink-0 w-64">
                  <div className="aspect-video bg-gray-50 rounded overflow-hidden flex items-center justify-center">
                    {isVideo(m.mime) ? (
                      <video src={mediaUrl(m.id)} controls preload="metadata" playsInline className="w-full h-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaUrl(m.id)}
                        alt={m.alt || m.title || m.filename || m.id}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  {m.caption && <div className="mt-1 text-[10px] opacity-70 truncate">{m.caption}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Автор(ы) и теги */}
      <div className="mt-8 border-t pt-6 text-sm opacity-80">Автор(ы): {authorsFio}</div>

      {a.tags.length > 0 && (
        <div className="mt-3 text-sm flex flex-wrap gap-2">
          {a.tags.map((t) => (
            <a key={t.tagId} className="px-2 py-1 rounded border text-xs hover:bg-gray-50" href={`/tag/${encodeURIComponent(t.tag.slug)}`}>
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
