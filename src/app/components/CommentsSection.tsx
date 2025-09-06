// app/components/CommentsSection.tsx

import Link from "next/link";
import { CommentsForm } from "./CommentsForm";
import { getSessionUser } from "../../../lib/session";
import { prisma } from "../../../lib/db";

function formatDate(d: Date) {
  return new Date(d).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function CommentsSection({
  articleId,
  slug,
}: {
  articleId: string;
  slug: string;
}) {
  const sessionUser = await getSessionUser();
  const isLoggedIn = Boolean(sessionUser?.id);

  const [article, userRow] = await Promise.all([
    prisma.article.findUnique({
      where: { id: articleId },
      select: { commentsEnabled: true, commentsGuestsAllowed: true },
    }),
    isLoggedIn
      ? prisma.user.findUnique({
          where: { id: sessionUser!.id },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  const userName = (userRow?.name || "").trim() || null;
  const comments = await prisma.comment.findMany({
    where: { articleId, status: "PUBLISHED" },
    include: { author: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  const commentsDisabled = !article?.commentsEnabled;
  const guestsBlocked = article?.commentsGuestsAllowed === false;

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">Комментарии</h2>

      {commentsDisabled ? (
        <div className="mt-3 rounded-xl bg-neutral-100 p-3 text-sm ring-1 ring-neutral-200">
          Комментарии к этой статье отключены.
        </div>
      ) : guestsBlocked && !isLoggedIn ? (
        <div className="mt-3 rounded-xl bg-neutral-100 p-3 text-sm ring-1 ring-neutral-200">
          Комментировать могут только авторизованные пользователи.{" "}
          <a className="underline" href="/api/auth/signin">
            Войти
          </a>
          .
        </div>
      ) : null}

      {!commentsDisabled && (isLoggedIn || !guestsBlocked) && (
        <CommentsForm
          articleId={articleId}
          slug={slug}
          isLoggedIn={isLoggedIn}
          userName={userName}
        />
      )}

      <div className="mt-6 space-y-5">
        {comments.length === 0 ? (
          <div className="text-sm text-neutral-600">Пока нет комментариев.</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-neutral-200 ring-1 ring-neutral-300 text-xl">
                {c.author?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.author.image}
                    alt=""
                    className="h-12 w-12 object-cover"
                  />
                ) : c.author ? (
                  <span>🙂</span>
                ) : (
                  <span title="Гость">👤</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
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
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ring-1 ring-neutral-300">
                        Гость
                      </span>
                      <span>{c.guestName || "аноним"}</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-neutral-500">
                  {formatDate(c.createdAt)}
                </div>
                <div className="mt-1 whitespace-pre-wrap leading-relaxed">
                  {c.body}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
