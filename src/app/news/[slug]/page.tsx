export const dynamic = "force-dynamic";

import { generateHTML } from "@tiptap/html/server";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
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
import type { Metadata } from "next";
import { ShareButtons } from "@/app/components/ShareButtons";

const ImageExtended = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-media-id": {
        default: null,
        parseHTML: (el) => el.getAttribute("data-media-id") || null,
        renderHTML: (attrs) => (attrs["data-media-id"] ? { "data-media-id": String(attrs["data-media-id"]) } : {}),
      },
      width: { default: null },
      height: { default: null },
      alt: { default: null },
      title: { default: null },
      caption: { default: null },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const { title, ...attrs } = HTMLAttributes;
    if (title) {
      return [
        "figure",
        { class: "media-figure" },
        ["img", attrs],
        ["figcaption", { class: "media-caption" }, title],
      ];
    }
    return ["figure", { class: "media-figure" }, ["img", attrs]];
  },
});

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
      caption: { default: null },
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
    const { title, caption, ...attrs } = HTMLAttributes;
    attrs.controls = "";
    attrs.playsinline = "";
    if (attrs.preload == null) attrs.preload = "metadata";
    
    const displayCaption = title || caption;
    if (displayCaption) {
      return [
        "figure",
        { class: "media-figure" },
        ["video", attrs],
        ["figcaption", { class: "media-caption" }, displayCaption],
      ];
    }
    return ["figure", { class: "media-figure" }, ["video", attrs]];
  },
});

const isVideo = (mime?: string | null) => typeof mime === "string" && mime.toLowerCase().startsWith("video/");

function renderContentHTML(content: any, styles?: { fontSize: string, lineHeight: string, paragraphSpacing: string }) {
  const exts = [
    StarterKit.configure({
      strike: false,
      code: false,
      codeBlock: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      horizontalRule: false,
      bold: false,
      italic: false,
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "text-blue-600 underline underline-offset-2",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      },
    }),
    Bold.extend({ inclusive: false }),
    Italic.extend({ inclusive: false }),
    Underline.extend({ inclusive: false }),
    ImageExtended.configure({ allowBase64: false, inline: false }),
    Video,
  ];
  let html = generateHTML(content ?? { type: "doc", content: [{ type: "paragraph" }] }, exts);

  if (styles) {
    const wrapperStyles = `--editor-font-size: ${styles.fontSize}; --editor-line-height: ${styles.lineHeight}; --editor-paragraph-spacing: ${styles.paragraphSpacing};`;
    html = `<div style="${wrapperStyles.replace(/\s+/g, ' ').trim()}">${html}</div>`;
  }

  const options: IOptions = {
    allowedTags: sanitizeDefaults.allowedTags.concat(["img", "figure", "figcaption", "video", "strong", "em", "u", "div"]),
    allowedAttributes: {
      a: ["href", "target", "rel", "class"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding", "data-media-id", "class"],
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
      div: ["style"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: true,
  };
  return sanitizeHtml(html, options);
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getBaseUrl() {
  const fromEnv = process.env.NEXTAUTH_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:3000";
}

const mediaUrl = (id: string) => `/admin/media/${id}/raw`;

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;

  const article = await prisma.article.findUnique({
    where: { slug },
    include: {
      coverMedia: true,
      media: { include: { media: true } },
      section: true,
      tags: { include: { tag: true } },
      authors: { include: { author: true }, orderBy: { order: "asc" } },
    },
  });

  if (!article || article.status !== "PUBLISHED") {
    return {
      title: "Озерский Вестник",
      description: "Новости города Озерск",
    };
  }

  const baseUrl = getBaseUrl();
  const asciiBaseUrl = baseUrl.includes("озерский-вестник.рф")
    ? baseUrl.replace("озерский-вестник.рф", "xn----dtbhcghdehg5ad2aogq.xn--p1ai")
    : baseUrl;

  const mainBodyImage = article.media.find((m) => m.role === "BODY" && !isVideo(m.media.mime))?.media ?? null;
  const mainOrCover =
    (article.coverMedia && !isVideo(article.coverMedia.mime) && article.coverMedia) ||
    mainBodyImage ||
    article.coverMedia ||
    null;

  const imageUrl = mainOrCover ? `${asciiBaseUrl}${mediaUrl(mainOrCover.id)}` : undefined;

  const url = `${asciiBaseUrl}/news/${article.slug}`;
  const title = article.title;
  const description = article.subtitle ?? article.excerpt ?? "Новости Озерска";

  const authorNames = article.authors
    .map((a) => [a.author.lastName, a.author.firstName, a.author.patronymic].filter(Boolean).join(" "))
    .filter(Boolean);

  const tagKeywords = article.tags.map(t => t.tag.name);
  const keywords = ["Озерск", "новости Озерска", article.section?.name].filter((k): k is string => Boolean(k)).concat(tagKeywords);

  return {
    title,
    description,
    keywords,
    authors: authorNames.map(name => ({ name })),
    alternates: {
      canonical: `/news/${article.slug}`,
    },
    openGraph: {
      type: "article",
      url,
      siteName: "Озерский Вестник",
      title,
      description,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt?.toISOString(),
      section: article.section?.name ?? undefined,
      authors: authorNames.length > 0 ? authorNames : undefined,
      tags: tagKeywords,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: mainOrCover?.alt || mainOrCover?.title || title,
              type: mainOrCover?.mime || "image/jpeg",
            },
          ]
        : [],
      locale: "ru_RU",
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : [],
      site: "@ozerskvestnik",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    other: {
      "article:published_time": article.publishedAt?.toISOString() ?? "",
      "article:modified_time": article.updatedAt?.toISOString() ?? "",
      "article:section": article.section?.name ?? "",
      "article:author": authorNames.join(", "),
      "article:tag": tagKeywords.join(", "),
      "og:locale": "ru_RU",
      "og:image": imageUrl ?? "",
      "og:image:width": "1200",
      "og:image:height": "630",
      "og:image:alt": mainOrCover?.alt || mainOrCover?.title || title,
      "vk:image": imageUrl ?? "",
    },
  };
}

export default async function ArticlePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const isMobile = /(Android|iPhone|iPad|iPod|IEMobile|BlackBerry|Opera Mini|Mobile)/i.test(ua);

  const { slug } = await params;

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

  const mainMedia = a.media.find((m) => m.role === "BODY")?.media || null;
  const galleryMedia = a.media.filter((m) => m.role === "GALLERY").map((m) => m.media);

  const articleHtml = renderContentHTML(a.content, {
    fontSize: a.fontSize ?? "16px",
    lineHeight: a.lineHeight ?? "1.75",
    paragraphSpacing: a.paragraphSpacing ?? "1.5em",
  });

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

  const baseUrl = getBaseUrl();
  
  const cyrillicBaseUrl = baseUrl.includes("xn----dtbhcghdehg5ad2aogq.xn--p1ai")
    ? baseUrl.replace("xn----dtbhcghdehg5ad2aogq.xn--p1ai", "озерский-вестник.рф")
    : baseUrl;
  
  const asciiBaseUrl = baseUrl.includes("озерский-вестник.рф")
    ? baseUrl.replace("озерский-вестник.рф", "xn----dtbhcghdehg5ad2aogq.xn--p1ai")
    : baseUrl;
  
  const articleUrl = `${asciiBaseUrl}/news/${a.slug}`;
  
  const shareTitle = a.title;
  const shareDescription = a.subtitle ?? a.excerpt ?? undefined;
  const mainOrCoverForShare =
    (a.coverMedia && !isVideo(a.coverMedia.mime) && a.coverMedia) ||
    (mainMedia && !isVideo(mainMedia.mime) && mainMedia) ||
    a.coverMedia ||
    null;
  
  const shareImage = mainOrCoverForShare ? `${asciiBaseUrl}${mediaUrl(mainOrCoverForShare.id)}` : undefined;

  const authorsArr = a.authors.map((x) => ({
    slug: x.author.slug,
    name: [x.author.lastName, x.author.firstName, x.author.patronymic].filter(Boolean).join(" "),
  }));

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: a.title,
    description: a.subtitle ?? a.excerpt ?? undefined,
    image: shareImage ? [shareImage] : undefined,
    datePublished: a.publishedAt?.toISOString(),
    dateModified: a.updatedAt?.toISOString(),
    author: authorsArr.map(author => ({
      "@type": "Person",
      name: author.name,
    })),
    publisher: {
      "@type": "Organization",
      name: "Озерский Вестник",
      logo: {
        "@type": "ImageObject",
        url: `${asciiBaseUrl}/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${asciiBaseUrl}/news/${a.slug}`,
    },
    articleSection: a.section?.name ?? undefined,
    keywords: a.tags.map(t => t.tag.name).join(", "),
    inLanguage: "ru",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <main className="mx-auto w-full max-w-[1720px] px-4 sm:px-6 lg:px-8 py-6 min-h-screen">
        <div className="grid grid-cols-1 gap-6 lg:gap-8 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)] h-full">
          {!isMobile && <AllNewsList className="hidden lg:block" />}

          <article className="w-full max-w-[980px] overflow-hidden">
            <ViewBeacon articleId={a.id} />

            <style>{`
              .article-content {
                font-size: var(--editor-font-size, 16px);
                line-height: var(--editor-line-height, 1.75);
                color: #171717;
                word-wrap: break-word;
                overflow-wrap: anywhere;
              }
              .article-content p {
                margin-bottom: var(--editor-paragraph-spacing, 1.5em);
                font-size: var(--editor-font-size, 16px);
                line-height: var(--editor-line-height, 1.75);
                color: #171717;
                word-break: break-word;
              }
              .article-content p:last-child {
                margin-bottom: 0;
              }
              .article-content strong {
                font-weight: 700;
              }
              .article-content em {
                font-style: italic;
              }
              .article-content u {
                text-decoration: underline;
              }
              .article-content a {
                color: #2563eb;
                text-decoration: underline;
                text-underline-offset: 2px;
              }
              .article-content a:hover {
                color: #1d4ed8;
              }
              .article-content .media-figure {
                margin: 1.5rem auto;
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.5rem;
              }
              .article-content .media-figure img,
              .article-content .media-figure video {
                max-width: 100%;
                height: auto;
                display: block;
                border-radius: 0.75rem;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              }
              .article-content .media-caption {
                font-size: 0.875rem;
                color: #6b7280;
                font-style: italic;
                text-align: center;
                padding: 0 1rem;
              }
              .article-content img,
              .article-content video,
              .article-content iframe {
                max-width: 100%;
                height: auto;
              }
              .article-content table {
                display: block;
                width: 100%;
                overflow-x: auto;
              }
              .article-content pre,
              .article-content code {
                white-space: pre-wrap;
                word-break: break-word;
              }
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
                  <time dateTime={new Date(a.publishedAt).toISOString()}>
                    {new Date(a.publishedAt).toLocaleDateString("ru-RU")}
                  </time>
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

            <div className="article-content mt-6">
              <div dangerouslySetInnerHTML={{ __html: articleHtml }} />
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

            <ShareButtons url={articleUrl} title={shareTitle} description={shareDescription} imageUrl={shareImage} />

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
    </>
  );
}