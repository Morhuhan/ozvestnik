import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  const allowed = role && ["ADMIN", "EDITOR", "AUTHOR"].includes(role);

  if (!allowed) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent("/admin")}`);
  }

  return (
    <div className="min-h-screen">
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
}
