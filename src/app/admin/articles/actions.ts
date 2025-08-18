// src/app/admin/articles/actions.ts
"use server"

import { z } from "zod"
import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "../../../../lib/db"
import { requireRole } from "../../../../lib/session"
import { slugify } from "../../../../lib/slugify"

// ───────────────────────────────────────────────────────────────────────────────
// Schemas
// После перехода пикеров на JSON не валидируем section/tags как строки.
// Валидируем только общие поля статьи.
const BaseArticleSchema = z.object({
  title: z.string().min(3),
  subtitle: z.string().max(300).optional().nullable(),
  body: z.string().min(1),
})

// ───────────────────────────────────────────────────────────────────────────────
// Helpers

type AuthorInput =
  | { id: string }
  | { lastName: string; firstName: string; patronymic?: string | null }

function textToTiptapJSON(text: string) {
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  return {
    type: "doc",
    content: paras.map(p => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  }
}

function fieldOfP2002(e: Prisma.PrismaClientKnownRequestError): "title" | "slug" | "unknown" {
  const t = (e.meta as any)?.target
  const s = Array.isArray(t) ? t.join(",").toLowerCase() : String(t ?? "").toLowerCase()
  if (s.includes("title")) return "title"
  if (s.includes("slug")) return "slug"
  return "unknown"
}

// JSON парсеры из формы
function parseIdArrayJSON(input: FormDataEntryValue | null | undefined): string[] {
  if (input == null) return []
  try {
    const arr = JSON.parse(String(input)) as Array<{ id?: string }>
    if (!Array.isArray(arr)) return []
    return arr.map(x => x?.id).filter((v): v is string => typeof v === "string" && v.length > 0)
  } catch {
    return []
  }
}

function parseIdObjectJSON(input: FormDataEntryValue | null | undefined): string | null {
  if (input == null) return null
  try {
    const obj = JSON.parse(String(input)) as { id?: string } | null
    const id = obj && typeof obj === "object" ? obj.id : null
    return typeof id === "string" && id.length > 0 ? id : null
  } catch {
    return null
  }
}

// cгенерировать slug автора на основе ФИО
function authorSlugOf(a: { lastName: string; firstName: string; patronymic?: string | null }) {
  const parts = [a.lastName, a.firstName, a.patronymic].filter(Boolean).join(" ")
  return slugify(parts)
}

// принимает JSON из формы и возвращает упорядоченный список id авторов,
// создавая недостающих по ФИО
async function ensureAuthorIdsFromForm(json: string | null | FormDataEntryValue | undefined) {
  if (!json) return [] as string[]
  let arr: AuthorInput[] = []
  try {
    arr = JSON.parse(String(json))
  } catch {
    return []
  }
  const result: string[] = []
  for (const item of arr) {
    if ("id" in item && item.id) {
      result.push(item.id)
      continue
    }
    const fio = {
      lastName: (item as any).lastName?.trim() || "",
      firstName: (item as any).firstName?.trim() || "",
      patronymic: ((item as any).patronymic || "").trim() || null,
    }
    if (!fio.lastName || !fio.firstName) continue
    // существует?
    const existing = await prisma.author.findUnique({
      where: { lastName_firstName_patronymic: { ...fio } },
      select: { id: true },
    })
    if (existing) {
      result.push(existing.id)
      continue
    }
    // создать
    const slug = authorSlugOf(fio)
    // на случай редкой коллизии slug добавим суффикс
    let finalSlug = slug
    let n = 1
    while (await prisma.author.findUnique({ where: { slug: finalSlug }, select: { id: true } })) {
      n += 1
      finalSlug = `${slug}-${n}`
    }
    const created = await prisma.author.create({
      data: { ...fio, slug: finalSlug },
      select: { id: true },
    })
    result.push(created.id)
  }
  return result
}

// ───────────────────────────────────────────────────────────────────────────────
// CREATE

export async function createArticle(formData: FormData) {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"])

  const base = BaseArticleSchema.parse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle") || null,
    body: formData.get("body"),
  })

  const slug = slugify(String(formData.get("slug") || base.title))

  // уникальность заранее
  const conflict = await prisma.article.findFirst({
    where: { OR: [{ title: base.title }, { slug }] },
    select: { title: true, slug: true },
  })
  if (conflict?.title === base.title)
    redirect(`/admin/articles/new?error=${encodeURIComponent("Заголовок уже занят")}&field=title`)
  if (conflict?.slug === slug)
    redirect(`/admin/articles/new?error=${encodeURIComponent("Slug уже занят")}&field=slug`)

  const content = textToTiptapJSON(base.body)

  // section: JSON {id} | null
  const sectionId = parseIdObjectJSON(formData.get("section"))

  // tags: JSON [{id}]
  const tagIds = parseIdArrayJSON(formData.get("tags"))

  // авторы: JSON [{ id } | { lastName, firstName, ... }]
  const authorIds = await ensureAuthorIdsFromForm(formData.get("authors"))
  const authorCreate = authorIds.map((authorId, idx) => ({
    author: { connect: { id: authorId } },
    order: idx,
  }))

  let created: { id: string; slug: string } | undefined

  try {
    created = await prisma.article.create({
      data: {
        slug,
        title: base.title,
        subtitle: base.subtitle || undefined,
        status: "DRAFT",
        sectionId, // null если очищено
        content,
        excerpt: base.body.slice(0, 200),
        tags: { create: tagIds.map(tagId => ({ tag: { connect: { id: tagId } } })) },
        authors: { create: authorCreate },
      },
      select: { id: true, slug: true },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const f = fieldOfP2002(err)
      const msg =
        f === "title"
          ? "Заголовок уже занят"
          : f === "slug"
          ? "Slug уже занят"
          : "Уникальное поле уже занято"
      redirect(`/admin/articles/new?error=${encodeURIComponent(msg)}&field=${f}`)
    }
    console.error("[createArticle] error:", err)
    redirect(`/admin/articles/new?error=${encodeURIComponent("Ошибка сохранения")}`)
  }

  revalidatePath("/")
  revalidatePath(`/news/${encodeURIComponent(created!.slug)}`)
  revalidatePath(`/admin/articles`)
  redirect(`/admin/articles/${created!.id}?toast=${encodeURIComponent("Черновик создан")}`)
}

// ───────────────────────────────────────────────────────────────────────────────
// UPDATE

export async function updateArticle(id: string, formData: FormData) {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"])

  const data = BaseArticleSchema.partial().parse({
    title: formData.get("title") || undefined,
    subtitle: formData.get("subtitle") || undefined,
    body: formData.get("body") || undefined,
  })

  const patch: any = {}

  // title
  if (data.title) {
    const tConflict = await prisma.article.findFirst({
      where: { title: data.title, NOT: { id } },
      select: { id: true },
    })
    if (tConflict)
      redirect(`/admin/articles/${id}?error=${encodeURIComponent("Заголовок уже занят")}&field=title`)
    patch.title = data.title
  }

  // slug
  const rawSlug = String(formData.get("slug") ?? "").trim()
  if (rawSlug) {
    const norm = slugify(rawSlug)
    const sConflict = await prisma.article.findFirst({
      where: { slug: norm, NOT: { id } },
      select: { id: true },
    })
    if (sConflict)
      redirect(`/admin/articles/${id}?error=${encodeURIComponent("Slug уже занят")}&field=slug`)
    patch.slug = norm
  }

  // subtitle + body
  if (data.subtitle !== undefined) patch.subtitle = data.subtitle || null
  if (data.body) {
    patch.content = textToTiptapJSON(data.body)
    patch.excerpt = data.body.slice(0, 200)
  }

  // section (JSON {id} | null). Всегда присутствует скрытое поле → устанавливаем явно.
  const sectionId = parseIdObjectJSON(formData.get("section"))
  patch.sectionId = sectionId // null → очистка

  // tags (JSON [{id}]). Всегда присутствует скрытое поле: очищаем и пересоздаём связи.
  const tagsJson = formData.get("tags")
  if (tagsJson !== null) {
    const tagIds = parseIdArrayJSON(tagsJson)
    await prisma.tagOnArticle.deleteMany({ where: { articleId: id } })
    patch.tags = { create: tagIds.map(tagId => ({ tag: { connect: { id: tagId } } })) }
  }

  // authors (как и раньше)
  const authorsJson = formData.get("authors")
  if (authorsJson !== null) {
    const authorIds = await ensureAuthorIdsFromForm(authorsJson)
    await prisma.authorOnArticle.deleteMany({ where: { articleId: id } })
    patch.authors = {
      create: authorIds.map((authorId, idx) => ({ author: { connect: { id: authorId } }, order: idx })),
    }
  }

  let updatedSlug: string | undefined
  try {
    const res = await prisma.article.update({
      where: { id },
      data: patch,
      select: { slug: true },
    })
    updatedSlug = res.slug
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const f = fieldOfP2002(err)
      const msg =
        f === "title"
          ? "Заголовок уже занят"
          : f === "slug"
          ? "Slug уже занят"
          : "Уникальное поле уже занято"
      redirect(`/admin/articles/${id}?error=${encodeURIComponent(msg)}&field=${f}`)
    }
    console.error("[updateArticle] error:", err)
    redirect(`/admin/articles/${id}?error=${encodeURIComponent("Ошибка сохранения")}`)
  }

  revalidatePath("/")
  revalidatePath(`/news/${encodeURIComponent(updatedSlug!)}`)
  revalidatePath(`/admin/articles`)
  redirect(`/admin/articles/${id}?toast=${encodeURIComponent("Сохранено")}`)
}

// ───────────────────────────────────────────────────────────────────────────────
// PUBLISH / UNPUBLISH / DELETE (без изменений)

export async function publishArticle(id: string) {
  await requireRole(["EDITOR", "ADMIN"])
  const a = await prisma.article.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
    select: { slug: true },
  })
  revalidatePath("/")
  revalidatePath(`/news/${encodeURIComponent(a.slug)}`)
  revalidatePath(`/admin/articles`)
  redirect(`/admin/articles/${id}?toast=${encodeURIComponent("Опубликовано")}`)
}

export async function unpublishArticle(id: string) {
  await requireRole(["EDITOR", "ADMIN"])
  const a = await prisma.article.update({
    where: { id },
    data: { status: "DRAFT", publishedAt: null },
    select: { slug: true },
  })
  revalidatePath("/")
  revalidatePath(`/news/${encodeURIComponent(a.slug)}`)
  revalidatePath(`/admin/articles`)
  redirect(`/admin/articles/${id}?toast=${encodeURIComponent("Снято с публикации")}`)
}

export async function deleteArticle(id: string) {
  await requireRole(["EDITOR", "ADMIN"])
  await prisma.article.delete({ where: { id } })
  revalidatePath("/")
  revalidatePath("/admin/articles")
  redirect(`/admin/articles?toast=${encodeURIComponent("Статья удалена")}`)
}
