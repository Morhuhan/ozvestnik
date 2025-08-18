import { NextResponse } from "next/server"
import { prisma } from "../../../../lib/db"
import { slugify } from "../../../../lib/slugify"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type") || "article" // article|section|tag
  const title = (searchParams.get("title") || "").trim()
  const base = slugify(title || "item")

  async function exists(slug: string) {
    if (type === "article") return prisma.article.findUnique({ where: { slug } })
    if (type === "section") return prisma.section.findUnique({ where: { slug } })
    return prisma.tag.findUnique({ where: { slug } })
  }

  let candidate = base
  let i = 1
  while (await exists(candidate)) {
    i++
    candidate = `${base}-${i}`
  }

  return NextResponse.json({ slug: candidate })
}
