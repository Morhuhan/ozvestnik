// app/(site)/news/[slug]/page.tsx

export const dynamic = "force-dynamic";

import { generateHTML } from "@tiptap/html/server";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import sanitizeHtml, { defaults as sanitizeDefaults, IOptions } from "sanitize-html";
import CommentsSection from "@/app/components/CommentsSection";
import LightboxGallery, { type GalleryItem } from "@/app/components/LightboxGallery";
import { notFound } from "next/navigation";
import AllNewsList from "../../components/AllNewsList";
import ArticleTile, { type ArticleTileProps } from "../../components/ArticleTile";
import ViewBeacon from "./view-beacon";
import Avatar from "@/app/components/Avatar";
import { prisma } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/session";

function renderContentHTML(content: any) {
  const exts = [
    StarterKit.configure({
      strike: false,
      code: false,
      codeBlock: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      horizontalRule: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "text-blue-700 underline underline-offset-2",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      },
    }),
    Image.configure({ allowBase64: false, inline: false }),
  ];
  const html = generateHTML(content ?? { type: "doc", content: [{ type: "paragraph" }] }, exts);

  const options: IOptions = {
    allowedTags: sanitizeDefaults.allowedTags.concat(["img", "figure", "figcaption"]),
    allowedAttributes: {
      a: ["href", "target", "rel", "class"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding", "data-media-id", "data-captionized", "class"],
      figure: ["class"],
      figcaption: ["class"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: true,
  };
  return sanitizeHtml(html, options);
}

function injectImageCaptions(html: string, mediaById: Map<string, { title?: string | null }>) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return html.replace(/<img\b([^>]*?)\/?>/gi, (full, attrs: string) => {
    if (/\sdata-captionized\s*=\s*"/i.test(attrs)) return full;
    let id: string | null = null;
    const mData = attrs.match(/\sdata-media-id\s*=\s*"([^"]+)"/i);
    if (mData) id = mData[1];
    if (!id) {
      const mSrc = attrs.match(/\ssrc\s*=\s*"([^"]+)"/i);
      const mId = mSrc?.[1].match(/\/admin\/media\/([^/]+)\/raw/i);
      if (mId) id = mId[1];
    }
    if (!id) return full;
    const title = mediaById.get(id)?.title?.trim();
    if (!title) return full;
    const attrsWithMark = attrs.replace(/\s+$/, "") + ' data-captionized="1"';
    return `<figure class="media-figure"><img${attrsWithMark}><figcaption class="media-caption">${esc(title)}</figcaption></figure>`;
  });
}

function formatDate(d: Date) {
  return new Date(d).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

type ReadOnlyComment = {
  id: string;
  body: string;
  createdAt: Date;
  parentId: string | null;
  author: { id: string; name: string | null; image: string | null } | null;
  guestName: string | null;
};

type ReadOnlyNode = ReadOnlyComment & { children: ReadOnlyNode[] };

function buildTree(rows: ReadOnlyComment[]): ReadOnlyNode[] {
  const map = new Map<string, ReadOnlyNode>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: ReadOnlyNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
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

  const mediaUrl = (id: string) => `/admin/media/${id}/raw`;
  const isVideo = (mime?: string | null) => typeof mime === "string" && mime.toLowerCase().startsWith("video/");

  const mainMedia = a.media.find((m) => m.role === "BODY")?.media || null;
  const galleryMedia = a.media.filter((m) => m.role === "GALLERY").map((m) => m.media);

  const mediaById = new Map<string, { title?: string | null }>();
  for (const m of a.media) mediaById.set(m.media.id, { title: m.media.title });

  const articleHtmlRaw = renderContentHTML(a.content);
  const articleHtml = injectImageCaptions(articleHtmlRaw, mediaById);

  // ─── ЧИТАЙТЕ ТАКЖЕ: 3 последних, приоритет — тот же раздел ─────────────────
  const sameSection = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      id: { not: a.id },
      publishedAt: { not: null as any },
      sectionId: a.section?.id ?? undefined,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 3,
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      publishedAt: true,
      coverMedia: { select: { id: true } },
      section: { select: { slug: true, name: true } },
      tags: { include: { tag: true } },
      viewsCount: true,
    },
  });

  const needExtra = Math.max(0, 3 - sameSection.length);
  const fillers = needExtra
    ? await prisma.article.findMany({
        where: {
          status: "PUBLISHED",
          id: { notIn: [a.id, ...sameSection.map((x) => x.id)] },
          publishedAt: { not: null as any },
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: needExtra,
        select: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          publishedAt: true,
          coverMedia: { select: { id: true } },
          section: { select: { slug: true, name: true } },
          tags: { include: { tag: true } },
          viewsCount: true,
        },
      })
    : [];

  const also = [...sameSection, ...fillers];
  const alsoIds = also.map((x) => x.id);
  const commentsGrouped = alsoIds.length
    ? await prisma.comment.groupBy({
        by: ["articleId"],
        where: { articleId: { in: alsoIds }, status: "PUBLISHED" },
        _count: { articleId: true },
      })
    : [];
  const commentsById = new Map<string, number>(commentsGrouped.map((g) => [g.articleId, g._count.articleId]));

  const alsoTiles: ArticleTileProps[] = also.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle ?? null,
    publishedAt: r.publishedAt ?? undefined,
    coverId: r.coverMedia?.id ?? null,
    section: { slug: r.section?.slug ?? null, name: r.section?.name ?? null },
    tags: r.tags.map((x) => ({ id: x.tag.id, slug: x.tag.slug, name: x.tag.name })),
    commentsCount: commentsById.get(r.id) ?? 0,
    viewsCount: r.viewsCount ?? 0,
  }));
  // ─────────────────────────────────────────────────────────────────────────────

  const formDisabledForViewer = !commentsEnabled || (!commentsGuestsAllowed && !isLoggedIn);
  let readOnlyComments: ReadOnlyComment[] | null = null;

  if (formDisabledForViewer) {
    const cs = await prisma.comment.findMany({
      where: { articleId: a.id, status: "PUBLISHED" },
      include: { author: { select: { id: true, name: true, image: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    readOnlyComments = cs.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      parentId: c.parentId ?? null,
      author: c.author ? { id: c.author.id, name: c.author.name, image: c.author.image } : null,
      guestName: c.guestName ?? null,
    }));
  }

  const galleryItems: GalleryItem[] = galleryMedia.map((m) => ({
    id: m.id,
    url: mediaUrl(m.id),
    title: m.title ?? undefined,
    isVideo: isVideo(m.mime),
  }));

  const authorsFio = a.authors.length
    ? a.authors.map((x) => [x.author.lastName, x.author.firstName, x.author.patronymic].filter(Boolean).join(" ")).join(", ")
    : "—";

  return (
    <main className="mx-auto w-full max-w-[1720px] px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
        <AllNewsList className="self-start" />

        <article className="max-w-[980px]">
          <ViewBeacon articleId={a.id} />

          <style>{`
            .prose img { border-radius: .75rem; margin: 1rem auto; height: auto; }
            .media-figure { margin: 1rem 0; text-align: center; }
            .media-caption { font-size: 12px; opacity: .7; margin-top: .35rem; }
          `}</style>

          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
            <span className="rounded-full bg-neutral-200 px-2.5 py-1 ring-1 ring-neutral-300">
              {a.section?.name ?? "Без раздела"}
            </span>
            {a.publishedAt && (
              <time className="rounded-full bg-neutral-100 px-2.5 py-1 ring-1 ring-neutral-200">
                {new Date(a.publishedAt).toLocaleDateString("ru-RU")}
              </time>
            )}
          </div>

          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900">{a.title}</h1>
          {a.subtitle && <p className="mt-2 text-[17px] leading-relaxed text-neutral-800">{a.subtitle}</p>}

          {mainMedia && (
            <figure className="mt-6 overflow-hidden rounded-2xl bg-neutral-200 ring-1 ring-neutral-300 shadow-sm">
              <div className="aspect-video bg-black">
                {isVideo(mainMedia.mime) ? (
                  <video src={mediaUrl(mainMedia.id)} controls preload="metadata" playsInline className="h-full w-full object-contain bg-black" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(mainMedia.id)} alt={mainMedia.alt || mainMedia.title || a.title} className="h-full w-full object-cover" loading="eager" />
                )}
              </div>
              {(mainMedia.title || mainMedia.caption) && (
                <figcaption className="px-4 py-2 text-center text-xs text-neutral-600">{mainMedia.title || mainMedia.caption}</figcaption>
              )}
            </figure>
          )}

          <div className="prose prose-lg prose-neutral max-w-none mt-6">
            {/* eslint-disable-next-line react/no-danger */}
            <div dangerouslySetInnerHTML={{ __html: articleHtml }} />
          </div>

          {galleryItems.length > 0 && (
            <section className="mt-8">
              <div className="mb-2 text-sm font-medium text-neutral-800">Медиа</div>
              <LightboxGallery items={galleryItems} />
            </section>
          )}

          <div className="mt-8 border-t border-neutral-200 pt-6 text-sm text-neutral-700">
            Автор(ы): <span className="font-medium">{authorsFio}</span>
          </div>

          {a.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {a.tags.map((t) => (
                <a
                  key={t.tagId}
                  href={`/tag/${encodeURIComponent(t.tag.slug)}`}
                  className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs text-neutral-800 ring-1 ring-neutral-300 hover:bg-neutral-300"
                >
                  #{t.tag.name}
                </a>
              ))}
            </div>
          )}

          {/* ЧИТАЙТЕ ТАКЖЕ */}
          <section className="mt-10">
            <h2 className="mb-3 text-xl font-semibold">Читайте также</h2>
            {alsoTiles.length === 0 ? (
              <div className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-700 ring-1 ring-neutral-200">
                Пока нет материалов для рекомендации.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {alsoTiles.map((it) => (
                  <ArticleTile key={it.id} {...it} />
                ))}
              </div>
            )}
          </section>

          {formDisabledForViewer ? (
            <section className="mt-10">
              <h2 className="text-xl font-semibold">Комментарии</h2>
              <div className="mt-3 rounded-xl bg-neutral-100 p-3 text-sm text-neutral-800 ring-1 ring-neutral-200">
                {!commentsEnabled ? "Комментарии к этой статье отключены." : "Комментировать могут только авторизованные пользователи."}{" "}
                {!isLoggedIn && commentsEnabled && (
                  <>
                    <a className="underline" href="/api/auth/signin">Войти</a>.
                  </>
                )}
              </div>

              <div className="mt-6 space-y-4">
                {!readOnlyComments || readOnlyComments.length === 0 ? (
                  <div className="text-sm text-neutral-600">Комментариев нет.</div>
                ) : (
                  buildTree(readOnlyComments).map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <Avatar src={c.author?.image} size={36} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {c.author ? (
                            <a href={`/u/${c.author.id}`} className="underline decoration-dotted underline-offset-2" title="Открыть профиль">
                              {c.author.name || "Пользователь"}
                            </a>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ring-1 ring-neutral-300">Гость</span>
                              <span>{c.guestName || "аноним"}</span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500">{formatDate(c.createdAt)}</div>
                        <div className="mt-1 whitespace-pre-wrap leading-relaxed">{c.body}</div>

                        {c.children.length > 0 && (
                          <div className="mt-3 space-y-3 pl-6 border-l border-neutral-200">
                            {c.children.map((r) => (
                              <div key={r.id} className="flex gap-3">
                                <Avatar src={r.author?.image} size={32} />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 text-sm font-medium">
                                    {r.author ? (
                                      <a href={`/u/${r.author.id}`} className="underline decoration-dotted underline-offset-2" title="Открыть профиль">
                                        {r.author.name || "Пользователь"}
                                      </a>
                                    ) : (
                                      <>
                                        <span className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] ring-1 ring-neutral-300">Гость</span>
                                        <span>{r.guestName || "аноним"}</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="text-xs text-neutral-500">{formatDate(r.createdAt)}</div>
                                  <div className="mt-1 whitespace-pre-wrap leading-relaxed">{r.body}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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
      </div>
    </main>
  );
}
