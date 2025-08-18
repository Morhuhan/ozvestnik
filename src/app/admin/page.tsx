// app/admin/page.tsx
import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"

export default async function AdminHome() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Дашборд</h1>
      <p className="text-sm opacity-70">
        Вы вошли как {user?.name ?? user?.email} · роль: {user?.role}
      </p>

      <ul className="mt-6 list-disc list-inside space-y-1">
        <li><a className="underline" href="/admin/articles">Управление статьями</a></li>
        <li><a className="underline" href="/admin/media">Медиа-библиотека</a> (позже)</li>
        <li><a className="underline" href="/admin/users">Пользователи</a> (позже)</li>
      </ul>
    </div>
  )
}
