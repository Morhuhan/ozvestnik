// src/app/u/[id]/page.tsx
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/session";
import UserAvatar from "./user-avatar";
import BanControls from "./BanControls";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, viewer] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        image: true,
        bio: true,
        createdAt: true,
        isBanned: true,
        bannedAt: true,
        bannedUntil: true,
        banReason: true,
      },
    }),
    (async () => {
      const s = await getSessionUser();
      if (!s?.id) return null;
      return prisma.user.findUnique({
        where: { id: s.id },
        select: { id: true, role: true },
      });
    })(),
  ]);

  if (!user) notFound();

  const isAdmin = viewer?.role === "ADMIN";
  const canModerate = isAdmin && viewer?.id !== user.id;

  return (
    <main className="mx-auto w-full max-w-[980px] px-4 sm:px-6 lg:px-8 py-8">
      <header className="rounded-2xl bg-neutral-100 p-5 sm:p-6 ring-1 ring-black/5 shadow-sm">
        <div className="flex items-center gap-4 sm:gap-5">
          <UserAvatar image={user.image} name={user.name} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold text-neutral-900">
              {user.name || "Пользователь"}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700 ring-1 ring-neutral-200">
                На сайте с {new Date(user.createdAt).toLocaleDateString("ru-RU")}
              </span>

              {user.isBanned && (
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800 ring-1 ring-red-200">
                  Заблокирован
                  {user.bannedUntil
                    ? ` до ${new Date(user.bannedUntil).toLocaleString("ru-RU")}`
                    : ""}
                </span>
              )}
            </div>
          </div>

          {canModerate && (
            <div className="shrink-0">
              <BanControls
                userId={user.id}
                initial={{
                  isBanned: user.isBanned,
                  reason: user.banReason ?? "",
                  untilISO: user.bannedUntil
                    ? new Date(user.bannedUntil).toISOString()
                    : null,
                }}
              />
            </div>
          )}
        </div>
      </header>

      {user.isBanned && user.banReason && (
        <section className="mt-4 rounded-xl bg-red-50 p-4 ring-1 ring-red-100">
          <div className="text-sm font-medium text-red-800">
            Причина блокировки
          </div>
          <div className="mt-1 whitespace-pre-wrap text-sm text-red-900">
            {user.banReason}
          </div>
        </section>
      )}

      {user.bio && (
        <section className="mt-6 rounded-2xl bg-white p-5 sm:p-6 ring-1 ring-black/5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-neutral-900">Обо мне</h2>
          <p className="whitespace-pre-wrap break-words leading-relaxed text-neutral-800">
            {user.bio}
          </p>
        </section>
      )}
    </main>
  );
}
