// middleware.ts
import { withAuth } from "next-auth/middleware"

export default withAuth({
  callbacks: {
    authorized: ({ token }) => {
      // гость → нет токена
      if (!token) return false
      // впускаем только ADMIN/EDITOR/AUTHOR
      const role = (token as any).role
      return ["ADMIN", "EDITOR", "AUTHOR"].includes(role)
    },
  },
})

export const config = {
  matcher: ["/admin/:path*"],
}
