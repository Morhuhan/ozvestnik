// lib/session.ts
import { getServerSession } from "next-auth"
import { authOptions } from "./auth"

export type SessionUser = {
  id: string
  email?: string | null
  role?: "ADMIN" | "EDITOR" | "AUTHOR" | "READER"
}

export async function getSessionUser() {
  const session = await getServerSession(authOptions)
  return session?.user as SessionUser | undefined
}

export async function requireRole(roles: SessionUser["role"][]) {
  const user = await getSessionUser()
  if (!user || !user.role || !roles.includes(user.role)) {
    throw new Error("FORBIDDEN")
  }
  return user
}
