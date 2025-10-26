import { notFound } from "next/navigation";
import { prisma } from "../../../../../lib/db";
import { requireRole } from "../../../../../lib/session";
import { unpublishArticle, deleteArticle } from "../actions";
import { EditArticleForm } from "./EditArticleForm";
import { DeleteConfirmButton } from "../../components/DeleteConfirmButton";

function tiptapToPlain(content: any): string {
  try {
    const paras: string[] =
      content?.content?.map((p: any) => p?.content?.map((t: any) => t?.text || "").join("")) || [];
    return paras.join("\n\n").trim();
  } catch {
    return "";
  }
}

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const { id } = await params;

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

  const bodyPlain = tiptapToPlain(article.content);
  const initialAuthors = article.authors.map((x) => x.author);
  const initialTags = article.tags.map((t) => ({
    id: t.tag.id,
    name: t.tag.name,
    slug: t.tag.slug,
  }));
  const initialSection = article.section
    ? { id: article.section.id, name: article.section.name, slug: article.section.slug }
    : null;

  const coverMedia = article.coverMedia ?? null;
  const mainMedia = article.media.find((m) => m.role === "BODY")?.media || null;
  const galleryMedia = article.media.filter((m) => m.role === "GALLERY").map((m) => m.media);

  const onUnpublish = unpublishArticle.bind(null, article.id);
  const onDelete = deleteArticle.bind(null, article.id);

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <EditArticleForm
          articleId={article.id}
          isPublished={article.status === "PUBLISHED"}
          initialTitle={article.title}
          initialSlug={article.slug}
          initialSubtitle={article.subtitle}
          initialSection={initialSection}
          initialTags={initialTags}
          initialAuthors={initialAuthors as any}
          coverMedia={coverMedia}
          mainMedia={mainMedia}
          galleryMedia={galleryMedia}
          initialDoc={article.content as any}
          initialPlain={bodyPlain}
          commentsEnabled={article.commentsEnabled}
          commentsGuestsAllowed={article.commentsGuestsAllowed}
        />

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Действия</h3>
          <div className="flex flex-wrap gap-3">
            {article.status === "PUBLISHED" && (
              <form action={onUnpublish}>
                <button className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  Снять с публикации
                </button>
              </form>
            )}
            <form action={onDelete}>
              <DeleteConfirmButton />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}