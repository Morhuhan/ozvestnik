// src/app/admin/articles/page.tsx
import Link from "next/link";
import { prisma } from "../../../../lib/db";
import { requireRole } from "../../../../lib/session";
import ToggleInCarousel from "../components/toggle-in-carousel";

export default async function ArticlesIndexPage() {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  // Основные данные по статьям
  const articles = await prisma.article.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      createdAt: true,
      publishedAt: true,
      section: { select: { slug: true, name: true } },
      coverMedia: { select: { id: true } },
      inCarousel: true,
      viewsCount: true, // 👁️ просмотры
    },
  });

  // Группировка комментариев по статьям
  const ids = articles.map((a) => a.id);
  const commentsGrouped = ids.length
    ? await prisma.comment.groupBy({
        by: ["articleId"],
        where: { articleId: { in: ids }, status: "PUBLISHED" },
        _count: { articleId: true },
      })
    : [];

  const commentsById = new Map<string, number>(
    commentsGrouped.map((g) => [g.articleId, g._count.articleId])
  );

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Статьи</h1>
        <Link href="/admin/articles/new" className="rounded bg-black px-3 py-2 text-white">
          Новая статья
        </Link>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="w-full min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2">Обложка</th>
              <th className="px-3 py-2">Заголовок</th>
              <th className="px-3 py-2">Раздел</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">Создана</th>
              <th className="px-3 py-2">Публ.</th>
              <th className="px-3 py-2">👁️ Просм.</th>
              <th className="px-3 py-2">💬 Комм.</th>
              <th className="px-3 py-2">Карусель</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>

          <tbody>
            {articles.map((a) => {
              const coverId = a.coverMedia?.id as string | undefined;
              const commentsCount = commentsById.get(a.id) ?? 0;

              return (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2">
                    {coverId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/admin/media/${coverId}/raw`}
                        alt=""
                        className="h-12 w-16 rounded border object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="opacity-40">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs opacity-60">/{a.slug}</div>
                  </td>

                  <td className="px-3 py-2">
                    {a.section ? `${a.section.name} (${a.section.slug})` : "—"}
                  </td>

                  <td className="px-3 py-2">{a.status}</td>

                  <td className="px-3 py-2">
                    {a.createdAt.toLocaleDateString("ru-RU")}
                  </td>

                  <td className="px-3 py-2">
                    {a.publishedAt ? a.publishedAt.toLocaleDateString("ru-RU") : "—"}
                  </td>

                  <td className="px-3 py-2 tabular-nums">{a.viewsCount}</td>

                  <td className="px-3 py-2 tabular-nums">{commentsCount}</td>

                  <td className="px-3 py-2">
                    <ToggleInCarousel
                      id={a.id}
                      isPublished={a.status === "PUBLISHED" && !!a.publishedAt}
                      initialChecked={a.inCarousel}
                    />
                  </td>

                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/articles/${a.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Редактировать
                    </Link>
                  </td>
                </tr>
              );
            })}

            {articles.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center opacity-60" colSpan={10}>
                  Пока нет статей.{" "}
                  <Link href="/admin/articles/new" className="underline">
                    Создать первую
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
