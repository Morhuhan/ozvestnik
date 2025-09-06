// src/app/u/[id]/page.tsx
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/db";
import UserAvatar from "./user-avatar";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, image: true, bio: true, createdAt: true },
  });

  if (!user) notFound();

  return (
    <main className="mx-auto w-full max-w-[980px] px-4 sm:px-6 lg:px-8 py-8">
      <header className="rounded-2xl bg-neutral-100 p-5 sm:p-6 ring-1 ring-black/5 shadow-sm">
        <div className="flex items-center gap-4 sm:gap-5">
          {/* Аватар с кликом */}
          <UserAvatar image={user.image} name={user.name} />

          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-neutral-900">{user.name || "Пользователь"}</h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700 ring-1 ring-neutral-200">
                На сайте с {new Date(user.createdAt).toLocaleDateString("ru-RU")}
              </span>
            </div>
          </div>
        </div>
      </header>

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
