// app/components/CommentsSection.tsx

import { getSessionUser } from "../../../lib/session";
import { prisma } from "../../../lib/db";
import { CommentsThread } from "./CommentsThread";
import { CommentsForm } from "./CommentsForm";

export default async function CommentsSection({
  articleId,
  slug,
}: {
  articleId: string;
  slug: string;
}) {
  const sessionUser = await getSessionUser();
  const isLoggedIn = Boolean(sessionUser?.id);

  const [article, userRow, comments] = await Promise.all([
    prisma.article.findUnique({
      where: { id: articleId },
      select: { commentsEnabled: true, commentsGuestsAllowed: true },
    }),
    isLoggedIn
      ? prisma.user.findUnique({
          where: { id: sessionUser!.id },
          select: { name: true, role: true },
        })
      : Promise.resolve(null),
    prisma.comment.findMany({
      where: { articleId, status: "PUBLISHED" },
      include: { author: { select: { id: true, name: true, image: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);

  const userName = (userRow?.name || "").trim() || null;
  const canModerate = userRow?.role === "ADMIN";

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
          Комментировать могут только авторизованные пользователи{" "}
          <a className="underline" href="/api/auth/signin">
            Войти
          </a>
          .
        </div>
      ) : null}

      {/* форма верхнего уровня */}
      {!commentsDisabled && (isLoggedIn || !guestsBlocked) && (
        <div className="mt-4">
          <CommentsForm
            articleId={articleId}
            slug={slug}
            isLoggedIn={isLoggedIn}
            userName={userName}
            parentId={null}
          />
        </div>
      )}

      <div className="mt-6">
        {comments.length === 0 ? (
          <div className="text-sm text-neutral-600">Пока нет комментариев.</div>
        ) : (
          <CommentsThread
            comments={comments.map((c) => ({
              id: c.id,
              body: c.body,
              createdAt: c.createdAt.toISOString(),
              parentId: c.parentId ?? null,
              author: c.author ? { id: c.author.id, name: c.author.name ?? null, image: c.author.image ?? null } : null,
              guestName: c.guestName ?? null,
            }))}
            canReply={!commentsDisabled && (isLoggedIn || !guestsBlocked)}
            canModerate={!!canModerate}
            articleId={articleId}
            slug={slug}
            isLoggedIn={isLoggedIn}
            userName={userName}
          />
        )}
      </div>
    </section>
  );
}
