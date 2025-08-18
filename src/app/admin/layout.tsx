// app/admin/layout.tsx
import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role as string | undefined
  const allowed = role && ["ADMIN", "EDITOR", "AUTHOR"].includes(role)

  if (!allowed) {
    // отправим на стандартную страницу входа NextAuth
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent("/admin")}`)
  }

  return (
    <div className="min-h-screen">
      <header className="border-b sticky top-0 bg-white">
        <div className="container mx-auto p-4 flex items-center justify-between">
          <div className="font-semibold">Админ · Озёрский вестник</div>
          <nav className="text-sm">
            <a className="mr-4 underline" href="/admin">Дашборд</a>
            <a className="mr-4 underline" href="/admin/articles">Статьи</a>
            <a className="underline" href="/api/auth/signout">Выйти</a>
          </nav>
        </div>
      </header>
      <main className="container mx-auto p-4">{children}</main>
    </div>
  )
}
