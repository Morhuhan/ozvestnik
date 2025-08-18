import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "../../../../../lib/db"
import { slugify } from "../../../../../lib/slugify"
import { Prisma } from "@prisma/client"

const CreateTagSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно"),
  slug: z.string().trim().optional(),
})

const SearchSchema = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const parsed = SearchSchema.safeParse({
      q: searchParams.get("q") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    })
    if (!parsed.success) return NextResponse.json({ items: [] })

    const q = parsed.data.q ?? ""
    const limit = parsed.data.limit ?? 20
    const tokens = q.toLowerCase().split(/\s+/).map(s => s.trim()).filter(Boolean)

    const mode = Prisma.QueryMode.insensitive
    const tokenClause = (t: string): Prisma.TagWhereInput => ({
      OR: [
        { name: { contains: t, mode } },
        { slug: { contains: t, mode } },
      ],
    })

    const where: Prisma.TagWhereInput =
      tokens.length === 0 ? {} : { AND: tokens.map(tokenClause) }

    const items = await prisma.tag.findMany({
      where,
      take: limit,
      orderBy: [{ name: "asc" }],
      select: { id: true, slug: true, name: true },
    })

    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [] })
  }
}

export async function POST(req: Request) {
  try {
    const { name, slug } = CreateTagSchema.parse(await req.json())
    const s = (slug && slug.trim()) || slugify(name)

    // уникальность по slug и name
    const exists = await prisma.tag.findFirst({
      where: { OR: [{ slug: s }, { name }] },
      select: { id: true, slug: true, name: true },
    })
    if (exists) {
      return NextResponse.json({ error: "Тег уже существует" }, { status: 409 })
    }

    const tag = await prisma.tag.create({
      data: { name, slug: s },
      select: { id: true, slug: true, name: true },
    })
    return NextResponse.json({ tag })
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message ?? "Ошибка"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
