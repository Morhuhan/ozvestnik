// src/app/u/[id]/page.tsx
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/db";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) notFound();

  return (
    <main className="container mx-auto p-4 max-w-3xl">
      <header className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-2xl">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt={user.name} className="h-full w-full object-cover" />
          ) : (
            <span>🙂</span>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <div className="text-xs opacity-60">Роль: {user.role}</div>
        </div>
      </header>

      {user.bio && (
        <section className="mt-6">
          <h2 className="text-sm font-medium mb-1">Обо мне</h2>
          <p className="whitespace-pre-wrap leading-relaxed">{user.bio}</p>
        </section>
      )}

      <section className="mt-6 text-xs opacity-60">
        На сайте с {new Date(user.createdAt).toLocaleDateString("ru-RU")}
      </section>
    </main>
  );
}
