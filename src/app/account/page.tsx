export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSessionUser } from "../../../lib/session";
import { prisma } from "../../../lib/db";
import ProfileForm from "./profile-form";

export default async function AccountPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) redirect(`/login?callbackUrl=${encodeURIComponent("/account")}`);

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, email: true, name: true, image: true, bio: true, role: true },
  });
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent("/account")}`);

  return (
    <main className="mx-auto w-full max-w-[980px] px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Личный кабинет</h1>
      </header>

      <div className="rounded-2xl bg-neutral-50 p-5 sm:p-6 ring-1 ring-black/5 shadow-sm">
        <ProfileForm initial={{ name: user.name || "", image: user.image || "", bio: user.bio || "" }} />
      </div>
    </main>
  );
}