import Link from "next/link";
import { prisma } from "../../../lib/db";
import { getSessionUser } from "../../../lib/session";
import { CommentsForm } from "./CommentsForm";

function formatDate(d: Date) {
  return new Date(d).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

export default async function CommentsSection({
  articleId,
  slug,
}: {
  articleId: string;
  slug: string;
}) {
  // Текущий пользователь (если авторизован)
  const sessionUser = await getSessionUser();

  // Имя авторизованного пользователя берём из БД
  let userName: string | null = null;
  if (sessionUser?.id) {
    const u = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { name: true },
    });
    userName = (u?.name || "").trim() || null;
  }

  // Комментарии к статье
  const comments = await prisma.comment.findMany({
    where: { articleId, status: "PUBLISHED" },
    include: { author: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">Комментарии</h2>

      {/* Форма добавления комментария */}
      <CommentsForm
        articleId={articleId}
        slug={slug}
        isLoggedIn={Boolean(sessionUser?.id)}
        userName={userName}
      />

      {/* Список комментариев */}
      <div className="mt-6 space-y-4">
        {comments.length === 0 ? (
          <div className="text-sm opacity-70">Пока нет комментариев. Будьте первым!</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              {/* Аватар */}
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

              {/* Тело комментария */}
              <div className="flex-1">
                <div className="text-sm font-medium flex items-center gap-2">
                  {c.author ? (
                    <Link
                      href={`/u/${c.author.id}`}
                      className="underline decoration-dotted underline-offset-2"
                      title="Открыть профиль"
                    >
                      {c.author.name || "Пользователь"}
                    </Link>
                  ) : (
                    <>
                      {/* Для гостя — рамочка с надписью "Гость" и рядом имя */}
                      <span className="inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 border">
                        Гость
                      </span>
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
  );
}
