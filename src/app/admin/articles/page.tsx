// src/app/admin/articles/page.tsx
import Link from "next/link";
import { prisma } from "../../../../lib/db";
import { requireRole } from "../../../../lib/session";

export default async function ArticlesIndexPage() {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

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
      // ⬇️ Берём обложку из отдельной связи
      coverMedia: { select: { id: true } },
    },
  });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Статьи</h1>
        <Link href="/admin/articles/new" className="px-3 py-2 rounded bg-black text-white">
          Новая статья
        </Link>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2">Обложка</th>
              <th className="px-3 py-2">Заголовок</th>
              <th className="px-3 py-2">Раздел</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">Создана</th>
              <th className="px-3 py-2">Публ.</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => {
              const coverId = a.coverMedia?.id as string | undefined;
              return (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2">
                    {coverId ? (
                      <img
                        src={`/admin/media/${coverId}/raw`}
                        alt=""
                        className="w-16 h-12 object-cover rounded border"
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
                  <td className="px-3 py-2">{a.createdAt.toLocaleDateString("ru-RU")}</td>
                  <td className="px-3 py-2">
                    {a.publishedAt ? a.publishedAt.toLocaleDateString("ru-RU") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/articles/${a.id}`} className="text-blue-600 hover:underline">
                      Редактировать
                    </Link>
                  </td>
                </tr>
              );
            })}
            {articles.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center opacity-60" colSpan={7}>
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
