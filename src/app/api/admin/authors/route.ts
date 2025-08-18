import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "../../../../../lib/db"
import { slugify } from "../../../../../lib/slugify"
import { Prisma } from "@prisma/client"

const CreateAuthorSchema = z.object({
  lastName: z.string().trim().min(1, "Фамилия обязательна"),
  firstName: z.string().trim().min(1, "Имя обязательно"),
  patronymic: z.string().trim().min(1, "Отчество обязательно"),
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
    if (!parsed.success) {
      return NextResponse.json({ items: [] })
    }

    const q = parsed.data.q ?? ""
    const limit = parsed.data.limit ?? 20
    const tokens = q.toLowerCase().split(/\s+/).map(s => s.trim()).filter(Boolean)

    const mode = Prisma.QueryMode.insensitive
    const tokenClause = (t: string): Prisma.AuthorWhereInput => ({
      OR: [
        { lastName:   { contains: t, mode } },
        { firstName:  { contains: t, mode } },
        { patronymic: { contains: t, mode } },
        { slug:       { contains: t, mode } },
      ],
    })

    const where: Prisma.AuthorWhereInput =
      tokens.length === 0 ? {} : { AND: tokens.map(tokenClause) }

    const items = await prisma.author.findMany({
      where,
      take: limit,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { patronymic: "asc" }],
      select: { id: true, slug: true, lastName: true, firstName: true, patronymic: true },
    })

    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [] })
  }
}

export async function POST(req: Request) {
  try {
    const { lastName, firstName, patronymic } = CreateAuthorSchema.parse(await req.json())

    const existing = await prisma.author.findUnique({
      where: { lastName_firstName_patronymic: { lastName, firstName, patronymic } },
      select: { id: true, slug: true, lastName: true, firstName: true, patronymic: true },
    })
    if (existing) return NextResponse.json({ author: existing })

    const base = slugify(`${lastName} ${firstName} ${patronymic}`)
    let final = base
    for (let n = 2; await prisma.author.findUnique({ where: { slug: final }, select: { id: true } }); n++) {
      final = `${base}-${n}`
    }

    const author = await prisma.author.create({
      data: { lastName, firstName, patronymic, slug: final },
      select: { id: true, slug: true, lastName: true, firstName: true, patronymic: true },
    })
    return NextResponse.json({ author })
  } catch (e: any) {
    const msg = e?.issues?.[0]?.message ?? "Ошибка"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
