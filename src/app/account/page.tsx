// src/app/account/page.tsx
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSessionUser } from "../../../lib/session";
import { prisma } from "../../../lib/db";
import ProfileForm from "./profile-form";

export default async function AccountPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/account")}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, email: true, name: true, image: true, bio: true, role: true },
  });

  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/account")}`);
  }

  return (
    <main className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">Личный кабинет</h1>
      <p className="text-sm opacity-70 mt-1">
        Ваше имя отображается на сайте рядом с комментариями и другими материалами.
      </p>

      <div className="mt-6 border rounded-2xl p-4">
        <ProfileForm
          initial={{
            name: user.name || "",
            image: user.image || "",
            bio: user.bio || "",
          }}
        />
        <div className="mt-4 text-xs opacity-70">
          Почта: <span className="font-mono">{user.email}</span> · Роль: {user.role}
        </div>
      </div>
    </main>
  );
}
