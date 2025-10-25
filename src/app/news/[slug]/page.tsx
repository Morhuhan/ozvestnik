export const dynamic = "force-dynamic";

import { generateHTML } from "@tiptap/html/server";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Node } from "@tiptap/core";
import sanitizeHtml, { defaults as sanitizeDefaults, IOptions } from "sanitize-html";
import CommentsSection from "@/app/components/CommentsSection";
import LightboxGallery, { type GalleryItem } from "@/app/components/LightboxGallery";
import { notFound } from "next/navigation";
import AllNewsList from "../../components/AllNewsList";
import ArticleTile, { type ArticleTileProps } from "../../components/ArticleTile";
import ViewBeacon from "./view-beacon";
import { prisma } from "../../../../lib/db";
import { headers } from "next/headers";
import Link from "next/link";

const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: { default: null },
      "data-media-id": {
        default: null,
        parseHTML: (el) => el.getAttribute("data-media-id") || null,
        renderHTML: (attrs) => (attrs["data-media-id"] ? { "data-media-id": String(attrs["data-media-id"]) } : {}),
      },
      width: { default: null },
      height: { default: null },
      poster: { default: null },
      title: { default: null },
      controls: { default: true },
      playsinline: { default: true },
      preload: { default: "metadata" },
      autoplay: { default: null },
      muted: { default: null },
      loop: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "video[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const attrs: Record<string, any> = { ...HTMLAttributes, controls: "", playsinline: "" };
    if (attrs.preload == null) attrs.preload = "metadata";
    return ["video", attrs];
  },
});

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
          class: "text-blue-700 underline underline-offset-2 break-words",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      },
    }),
    Image.configure({ allowBase64: false, inline: false }),
    Video,
  ];
  const html = generateHTML(content ?? { type: "doc", content: [{ type: "paragraph" }] }, exts);
  const options: IOptions = {
    allowedTags: sanitizeDefaults.allowedTags.concat(["img", "figure", "figcaption", "video"]),
    allowedAttributes: {
      a: ["href", "target", "rel", "class"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding", "data-media-id", "data-captionized", "class"],
      video: [
        "src",
        "title",
        "width",
        "height",
        "controls",
        "playsinline",
        "poster",
        "preload",
        "autoplay",
        "muted",
        "loop",
        "data-media-id",
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

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function ArticlePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const isMobile = /(Android|iPhone|iPad|iPod|IEMobile|BlackBerry|Opera Mini|Mobile)/i.test(ua);

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

  const mediaUrl = (id: string) => `/admin/media/${id}/raw`;
  const isVideo = (mime?: string | null) => typeof mime === "string" && mime.toLowerCase().startsWith("video/");

  const mainMedia = a.media.find((m) => m.role === "BODY")?.media || null;
  const galleryMedia = a.media.filter((m) => m.role === "GALLERY").map((m) => m.media);

  const mediaById = new Map<string, { title?: string | null }>();
  for (const m of a.media) mediaById.set(m.media.id, { title: m.media.title });

  const articleHtmlRaw = renderContentHTML(a.content);
  const articleHtml = injectImageCaptions(articleHtmlRaw, mediaById);

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
      authors: {
        orderBy: { order: "asc" },
        include: { author: { select: { id: true, slug: true, firstName: true, lastName: true, patronymic: true } } },
      },
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
        orderBy: [{ publishedAt: "desc" }, { createdAt: "asc" }],
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
          authors: {
            orderBy: { order: "asc" },
            include: { author: { select: { id: true, slug: true, firstName: true, lastName: true, patronymic: true } } },
          },
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
    authors: r.authors.map((x) => ({
      id: x.author.id,
      slug: x.author.slug,
      firstName: x.author.firstName,
      lastName: x.author.lastName,
      patronymic: x.author.patronymic,
    })),
    commentsCount: commentsById.get(r.id) ?? 0,
    viewsCount: r.viewsCount ?? 0,
  }));

  const galleryItems: GalleryItem[] = galleryMedia.map((m) => ({
    id: m.id,
    url: mediaUrl(m.id),
    title: m.title ?? undefined,
    isVideo: isVideo(m.mime),
  }));

  const authorsArr = a.authors.map((x) => ({
    slug: x.author.slug,
    name: [x.author.lastName, x.author.firstName, x.author.patronymic].filter(Boolean).join(" "),
  }));

  return (
    <main className="mx-auto w-full max-w-[1720px] px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 gap-6 lg:gap-8 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
        {!isMobile && <AllNewsList className="self-start hidden lg:block" />}

        <article className="w-full max-w-[980px] overflow-hidden">
          <ViewBeacon articleId={a.id} />

          <style>{`
            .prose { word-wrap: break-word; overflow-wrap: anywhere; }
            .prose p, .prose li, .prose h1, .prose h2, .prose h3, .prose h4 { word-break: break-word; }
            .prose img, .prose video, .prose iframe { max-width: 100%; height: auto; }
            .prose table { display: block; width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
            .prose pre, .prose code { white-space: pre-wrap; word-break: break-word; }
            .prose blockquote { overflow-wrap: anywhere; }
            .media-figure { margin: 1rem 0; text-align: center; }
            .media-figure img { max-width: 100%; height: auto; }
            .media-caption { font-size: 12px; opacity: .7; margin-top: .35rem; }
          `}</style>

          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
            {a.section?.slug ? (
              <Link
                href={`/search?${new URLSearchParams({ section: a.section.slug }).toString()}`}
                className="rounded-full bg-neutral-200 px-2.5 py-1 ring-1 ring-neutral-300 hover:bg-neutral-300"
              >
                {a.section.name}
              </Link>
            ) : (
              <span className="rounded-full bg-neutral-200 px-2.5 py-1 ring-1 ring-neutral-300">Без раздела</span>
            )}
            {a.publishedAt && (
              <Link
                href={`/search?${new URLSearchParams({ from: ymd(new Date(a.publishedAt)), to: ymd(new Date(a.publishedAt)) }).toString()}`}
                className="rounded-full bg-neutral-100 px-2.5 py-1 ring-1 ring-neutral-200 hover:bg-neutral-200"
              >
                {new Date(a.publishedAt).toLocaleDateString("ru-RU")}
              </Link>
            )}
          </div>

          <h1 className="mt-3 text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 break-words">{a.title}</h1>
          {a.subtitle && <p className="mt-2 text-[16px] sm:text-[17px] leading-relaxed text-neutral-800 break-words">{a.subtitle}</p>}

          {mainMedia && (
            <figure className="mt-6 overflow-hidden rounded-2xl bg-neutral-200 ring-1 ring-neutral-300 shadow-sm">
              <div className="aspect-video bg-black">
                {isVideo(mainMedia.mime) ? (
                  <video src={mediaUrl(mainMedia.id)} controls preload="metadata" playsInline className="h-full w-full object-contain bg-black" />
                ) : (
                  <img src={mediaUrl(mainMedia.id)} alt={mainMedia.alt || mainMedia.title || a.title} className="h-full w-full object-cover" loading="eager" />
                )}
              </div>
              {(mainMedia.title || mainMedia.caption) && (
                <figcaption className="px-4 py-2 text-center text-xs text-neutral-600 break-words">{mainMedia.title || mainMedia.caption}</figcaption>
              )}
            </figure>
          )}

          <div className="prose prose-base sm:prose-lg prose-neutral max-w-none mt-6 overflow-x-hidden">
            <div className="overflow-x-auto">
              <div dangerouslySetInnerHTML={{ __html: articleHtml }} />
            </div>
          </div>

          {galleryItems.length > 0 && (
            <section className="mt-8">
              <div className="mb-2 text-sm font-medium text-neutral-800">Медиа</div>
              <LightboxGallery items={galleryItems} />
            </section>
          )}

          <div className="mt-8 border-t border-neutral-200 pt-6 text-sm text-neutral-700">
            Автор(ы):{" "}
            {authorsArr.length ? (
              <span className="font-medium break-words">
                {authorsArr.map((u, i) => (
                  <span key={u.slug}>
                    {i > 0 ? ", " : ""}
                    <Link
                      href={`/search?${new URLSearchParams({ author: u.slug }).toString()}`}
                      className="hover:underline underline-offset-2"
                    >
                      {u.name}
                    </Link>
                  </span>
                ))}
              </span>
            ) : (
              <span className="font-medium">—</span>
            )}
          </div>

          {a.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {a.tags.map((t) => (
                <Link
                  key={t.tagId}
                  href={`/search?${new URLSearchParams({ tag: t.tag.slug }).toString()}`}
                  className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs text-neutral-800 ring-1 ring-neutral-300 hover:bg-neutral-300 break-words"
                >
                  #{t.tag.name}
                </Link>
              ))}
            </div>
          )}

          <section className="mt-10">
            <h2 className="mb-3 text-lg sm:text-xl font-semibold">Читайте также</h2>
            {alsoTiles.length === 0 ? (
              <div className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-700 ring-1 ring-neutral-200">Пока нет материалов для рекомендации.</div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {alsoTiles.map((it) => (
                  <ArticleTile key={it.id} {...it} />
                ))}
              </div>
            )}
          </section>

          <CommentsSection articleId={a.id} slug={a.slug} />
        </article>
      </div>
    </main>
  );
}
