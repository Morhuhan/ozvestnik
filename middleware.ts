// middleware.ts
import { withAuth } from "next-auth/middleware"

export default withAuth({
  callbacks: {
    authorized: ({ token }) => {
      if (!token) return false
      const role = (token as any).role
      return ["ADMIN", "EDITOR", "AUTHOR"].includes(role)
    },
  },
})

export const config = {
  matcher: ["/admin/:path*"],
}
