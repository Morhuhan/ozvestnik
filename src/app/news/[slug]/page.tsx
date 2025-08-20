export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/db";
import CommentsSection from "../../components/CommentsSection";

// Примитивный рендер плейн-текста из tiptap JSON
function renderContent(content: any) {
  const paras: string[] =
    content?.content?.map((p: any) => p?.content?.map((t: any) => t?.text || "").join("")) || [];
  return paras.map((p, i) => (
    <p key={i} className="mt-4 leading-relaxed">
      {p}
    </p>
  ));
}

export default async function ArticlePublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // ⬇️ params теперь async — ждём прежде чем читать свойства
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

  // Главный блок и лента
  const mainMedia = a.media.find((m) => m.role === "BODY")?.media || null;
  const galleryMedia = a.media.filter((m) => m.role === "GALLERY").map((m) => m.media);
  const coverId = a.coverMedia?.id;

  const authorsFio = a.authors.length
    ? a.authors
        .map((x) => [x.author.lastName, x.author.firstName, x.author.patronymic].filter(Boolean).join(" "))
        .join(", ")
    : "—";

  // Утилита
  const mediaUrl = (id: string) => `/admin/media/${id}/raw`;
  const isVideo = (mime?: string | null) =>
    typeof mime === "string" && mime.toLowerCase().startsWith("video/");

  return (
    <article className="container mx-auto p-4 max-w-3xl">
      {/* Верхняя служебная строка */}
      <div className="text-sm opacity-70">
        {a.section?.name ?? "Без раздела"} •{" "}
        {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("ru-RU") : ""}
      </div>

      {/* Заголовок и подзаголовок */}
      <h1 className="text-3xl font-bold mt-2">{a.title}</h1>
      {a.subtitle && <p className="mt-2 text-neutral-700">{a.subtitle}</p>}

      {/* Главный медиа-блок (фото/видео в начале) */}
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
          {mainMedia.caption && (
            <div className="text-xs opacity-70 mt-2">{mainMedia.caption}</div>
          )}
        </div>
      )}

      {/* Текст статьи */}
      <div className="mt-6">{renderContent(a.content)}</div>

      {/* Галерея / лента со скроллом */}
      {galleryMedia.length > 0 && (
        <section className="mt-8">
          <div className="text-sm font-medium mb-2">Медиа</div>
          <div className="overflow-x-auto">
            <div className="flex gap-3 py-1">
              {galleryMedia.map((m) => (
                <div key={m.id} className="shrink-0 w-64">
                  <div className="aspect-video bg-gray-50 rounded overflow-hidden flex items-center justify-center">
                    {isVideo(m.mime) ? (
                      <video
                        src={mediaUrl(m.id)}
                        controls
                        preload="metadata"
                        playsInline
                        className="w-full h-full object-cover"
                      />
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
                  {m.caption && (
                    <div className="mt-1 text-[10px] opacity-70 truncate">{m.caption}</div>
                  )}
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
      <CommentsSection articleId={a.id} slug={a.slug} />
    </article>
  );
}
