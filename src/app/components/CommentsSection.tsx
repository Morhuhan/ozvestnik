// app/components/CommentsSection.tsx
import { prisma } from "../../../lib/db";
import { getSessionUser } from "../../../lib/session";
import { CommentsThread } from "./CommentsThread";
import { CommentsForm } from "./CommentsForm";
import crypto from "crypto";
import { headers as getHeaders } from "next/headers";

function formatDateTimeRU(d: Date) {
  return new Date(d).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
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

  // headers() может быть промисом — используем await
  const hdrs = await getHeaders();
  const ipHeader = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "";
  const ip = (ipHeader.split(",")[0]?.trim() || "0.0.0.0") + "";
  const ipHash = sha256(ip);

  const [article, viewerRow, comments, guestBan] = await Promise.all([
    prisma.article.findUnique({
      where: { id: articleId },
      select: { commentsEnabled: true, commentsGuestsAllowed: true },
    }),
    isLoggedIn
      ? prisma.user.findUnique({
          where: { id: sessionUser!.id },
          select: {
            id: true,
            name: true,
            role: true,
            isBanned: true,
            bannedUntil: true,
            banReason: true,
          },
        })
      : Promise.resolve(null),
    prisma.comment.findMany({
      where: { articleId, status: "PUBLISHED" },
      include: { author: { select: { id: true, name: true, image: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    !isLoggedIn
      ? prisma.guestBan.findFirst({
          where: { AND: [{ ipHash }, { OR: [{ until: null }, { until: { gt: new Date() } }] }] },
          select: { reason: true, until: true },
        })
      : Promise.resolve(null),
  ]);

  const userName = (viewerRow?.name || "").trim() || null;

  const commentsDisabled = !article?.commentsEnabled;
  const guestsBlocked = article?.commentsGuestsAllowed === false;

  // иммунитет ролей
  const privileged = viewerRow ? (["ADMIN", "EDITOR", "AUTHOR"] as const).includes(viewerRow.role as any) : false;

  // Бан авторизованного
  const now = new Date();
  const bannedUntil = viewerRow?.bannedUntil ?? null;
  const isBannedNow = Boolean(viewerRow?.isBanned || (bannedUntil ? bannedUntil > now : false));

  // Бан гостя
  const isGuestBannedNow = !isLoggedIn && !!guestBan;

  // Модерация (админ)
  const canModerate = viewerRow?.role === "ADMIN";

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
          <a className="underline" href="/api/auth/signin">Войти</a>.
        </div>
      ) : null}

      {isLoggedIn && isBannedNow && !privileged && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <div className="font-medium">Ваш аккаунт заблокирован.</div>
          {viewerRow?.banReason && <div className="mt-1 whitespace-pre-wrap">Причина: {viewerRow.banReason}</div>}
          {bannedUntil ? (
            <div className="mt-1">Разблокировка: {formatDateTimeRU(bannedUntil)}</div>
          ) : (
            <div className="mt-1">Срок блокировки не указан.</div>
          )}
        </div>
      )}

      {!isLoggedIn && isGuestBannedNow && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <div className="font-medium">Вы заблокированы.</div>
          {guestBan?.reason && <div className="mt-1 whitespace-pre-wrap">Причина: {guestBan.reason}</div>}
          {guestBan?.until ? (
            <div className="mt-1">Разблокировка: {formatDateTimeRU(guestBan.until)}</div>
          ) : (
            <div className="mt-1">Срок блокировки не указан.</div>
          )}
        </div>
      )}

      {/* Форма отправки — только если разрешено писать */}
      {!commentsDisabled &&
        (isLoggedIn || !guestsBlocked) &&
        (privileged || (isLoggedIn ? !isBannedNow : !isGuestBannedNow)) && (
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

      {/* Поток комментариев и модерация — всегда видны.
          Кнопки ответа выключатся при commentsDisabled (canReply=false),
          а кнопки модерации видны только админу. */}
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
              author: c.author
                ? { id: c.author.id, name: c.author.name ?? null, image: c.author.image ?? null }
                : null,
              guestName: c.guestName ?? null,
            }))}
            canReply={
              !commentsDisabled &&
              (isLoggedIn || !guestsBlocked) &&
              (privileged || (isLoggedIn ? !isBannedNow : !isGuestBannedNow))
            }
            canModerate={Boolean(canModerate)}
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
