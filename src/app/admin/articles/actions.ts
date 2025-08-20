// src/app/admin/articles/actions.ts
"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../../../../lib/db";
import { requireRole } from "../../../../lib/session";
import { slugify } from "../../../../lib/slugify";

// ───────────────────────────────────────────────────────────────
// Schemas
const BaseArticleSchema = z.object({
  title: z.string().min(3),
  subtitle: z.string().max(300).optional().nullable(),
  body: z.string().min(1),
});

// ───────────────────────────────────────────────────────────────
// Helpers
type AuthorInput =
  | { id: string }
  | { lastName: string; firstName: string; patronymic?: string | null };

function textToTiptapJSON(text: string) {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    type: "doc",
    content: paras.map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  };
}

function fieldOfP2002(
  e: Prisma.PrismaClientKnownRequestError
): "title" | "slug" | "unknown" {
  const t = (e.meta as any)?.target;
  const s = Array.isArray(t) ? t.join(",").toLowerCase() : String(t ?? "").toLowerCase();
  if (s.includes("title")) return "title";
  if (s.includes("slug")) return "slug";
  return "unknown";
}

function parseIdArrayJSON(input: FormDataEntryValue | null | undefined): string[] {
  if (input == null) return [];
  try {
    const arr = JSON.parse(String(input)) as Array<{ id?: string }>;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => x?.id)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
  } catch {
    return [];
  }
}

function parseIdObjectJSON(input: FormDataEntryValue | null | undefined): string | null {
  if (input == null) return null;
  try {
    const obj = JSON.parse(String(input)) as { id?: string } | null;
    const id = obj && typeof obj === "object" ? obj.id : null;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

function authorSlugOf(a: { lastName: string; firstName: string; patronymic?: string | null }) {
  const parts = [a.lastName, a.firstName, a.patronymic].filter(Boolean).join(" ");
  return slugify(parts);
}

async function ensureAuthorIdsFromForm(json: string | null | FormDataEntryValue | undefined) {
  if (!json) return [] as string[];
  let arr: AuthorInput[] = [];
  try {
    arr = JSON.parse(String(json));
  } catch {
    return [];
  }
  const result: string[] = [];
  for (const item of arr) {
    if ("id" in item && item.id) {
      result.push(item.id);
      continue;
    }
    const fio = {
      lastName: (item as any).lastName?.trim() || "",
      firstName: (item as any).firstName?.trim() || "",
      patronymic: ((item as any).patronymic || "").trim() || null,
    };
    if (!fio.lastName || !fio.firstName) continue;

    const existing = await prisma.author.findUnique({
      where: { lastName_firstName_patronymic: { ...fio } },
      select: { id: true },
    });
    if (existing) {
      result.push(existing.id);
      continue;
    }

    const baseSlug = authorSlugOf(fio);
    let finalSlug = baseSlug;
    let n = 1;
    while (await prisma.author.findUnique({ where: { slug: finalSlug }, select: { id: true } })) {
      n += 1;
      finalSlug = `${baseSlug}-${n}`;
    }
    const created = await prisma.author.create({
      data: { ...fio, slug: finalSlug },
      select: { id: true },
    });
    result.push(created.id);
  }
  return result;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// ───────────────────────────────────────────────────────────────
// CREATE
export async function createArticle(formData: FormData) {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const base = BaseArticleSchema.parse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle") || null,
    body: formData.get("body"),
  });

  const slug = slugify(String(formData.get("slug") || base.title));

  const conflict = await prisma.article.findFirst({
    where: { OR: [{ title: base.title }, { slug }] },
    select: { title: true, slug: true },
  });
  if (conflict?.title === base.title) {
    redirect(
      `/admin/articles/new?error=${encodeURIComponent("Заголовок уже занят")}&field=title`
    );
  }
  if (conflict?.slug === slug) {
    redirect(`/admin/articles/new?error=${encodeURIComponent("Slug уже занят")}&field=slug`);
  }

  const content = textToTiptapJSON(base.body);

  const sectionId = parseIdObjectJSON(formData.get("section"));
  const tagIds = parseIdArrayJSON(formData.get("tags"));
  const authorIds = await ensureAuthorIdsFromForm(formData.get("authors"));
  const authorCreate = authorIds.map((authorId, idx) => ({
    author: { connect: { id: authorId } },
    order: idx,
  }));

  const coverId = parseIdObjectJSON(formData.get("cover"));
  const mainId = parseIdObjectJSON(formData.get("main"));
  const galleryIds = uniq(parseIdArrayJSON(formData.get("gallery"))).filter(
    (id) => id !== mainId
  );

  const mediaCreate: Array<{
    media: { connect: { id: string } };
    role: "BODY" | "GALLERY";
    order: number;
  }> = [];
  if (mainId) mediaCreate.push({ media: { connect: { id: mainId } }, role: "BODY", order: 0 });
  galleryIds.forEach((id, idx) =>
    mediaCreate.push({ media: { connect: { id } }, role: "GALLERY", order: idx })
  );

  // 🔹 ЧИТАЕМ чекбоксы НАПРЯМУЮ: "on" → true, иначе false
  // (если на странице new по умолчанию стоят defaultChecked, придёт "on")
  const commentsEnabled = formData.get("commentsEnabled") === "on";
  const commentsGuestsAllowed = formData.get("commentsGuestsAllowed") === "on";

  let created: { id: string; slug: string } | undefined;

  try {
    created = await prisma.article.create({
      data: {
        slug,
        title: base.title,
        subtitle: base.subtitle || undefined,
        status: "DRAFT",
        sectionId,
        content,
        excerpt: base.body.slice(0, 200),

        coverMediaId: coverId ?? null,
        coverUrl: coverId ? `/admin/media/${coverId}/raw` : null,

        tags: { create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) },
        authors: { create: authorCreate },

        media: mediaCreate.length ? { create: mediaCreate as any } : undefined,

        // ← сохраняем флаги один-в-один
        commentsEnabled,
        commentsGuestsAllowed,
      },
      select: { id: true, slug: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const f = fieldOfP2002(err);
      const msg =
        f === "title"
          ? "Заголовок уже занят"
          : f === "slug"
          ? "Slug уже занят"
          : "Уникальное поле уже занято";
      redirect(`/admin/articles/new?error=${encodeURIComponent(msg)}&field=${f}`);
    }
    console.error("[createArticle] error:", err);
    redirect(`/admin/articles/new?error=${encodeURIComponent("Ошибка сохранения")}`);
  }

  revalidatePath("/");
  revalidatePath(`/news/${encodeURIComponent(created!.slug)}`);
  revalidatePath(`/admin/articles`);
  redirect(`/admin/articles/${created!.id}?toast=${encodeURIComponent("Черновик создан")}`);
}

// ───────────────────────────────────────────────────────────────
// UPDATE
export async function updateArticle(id: string, formData: FormData) {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const data = BaseArticleSchema.partial().parse({
    title: formData.get("title") || undefined,
    subtitle: formData.get("subtitle") || undefined,
    body: formData.get("body") || undefined,
  });

  const patch: any = {};

  if (data.title) {
    const tConflict = await prisma.article.findFirst({
      where: { title: data.title, NOT: { id } },
      select: { id: true },
    });
    if (tConflict) {
      redirect(
        `/admin/articles/${id}?error=${encodeURIComponent("Заголовок уже занят")}&field=title`
      );
    }
    patch.title = data.title;
  }

  const rawSlug = String(formData.get("slug") ?? "").trim();
  if (rawSlug) {
    const norm = slugify(rawSlug);
    const sConflict = await prisma.article.findFirst({
      where: { slug: norm, NOT: { id } },
      select: { id: true },
    });
    if (sConflict) {
      redirect(
        `/admin/articles/${id}?error=${encodeURIComponent("Slug уже занят")}&field=slug`
      );
    }
    patch.slug = norm;
  }

  if (data.subtitle !== undefined) patch.subtitle = data.subtitle || null;
  if (data.body) {
    patch.content = textToTiptapJSON(data.body);
    patch.excerpt = data.body.slice(0, 200);
  }

  // Раздел — всегда задаём явно (скрытое поле у пикера)
  const sectionId = parseIdObjectJSON(formData.get("section"));
  patch.sectionId = sectionId;

  // Обложка
  const coverRaw = formData.get("cover");
  if (coverRaw !== null) {
    const str = String(coverRaw).trim();
    if (str && str.toLowerCase() !== "null") {
      const coverId = parseIdObjectJSON(str);
      if (coverId) {
        patch.coverMediaId = coverId;
        patch.coverUrl = `/admin/media/${coverId}/raw`;
      }
    } else if (str.toLowerCase() === "null") {
      patch.coverMediaId = null;
      patch.coverUrl = null;
    }
  }

  // Теги
  if (formData.get("tags") !== null) {
    const tagIds = parseIdArrayJSON(formData.get("tags"));
    await prisma.tagOnArticle.deleteMany({ where: { articleId: id } });
    patch.tags = { create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) };
  }

  // Авторы
  if (formData.get("authors") !== null) {
    const authorIds = await ensureAuthorIdsFromForm(formData.get("authors"));
    await prisma.authorOnArticle.deleteMany({ where: { articleId: id } });
    patch.authors = {
      create: authorIds.map((authorId, idx) => ({
        author: { connect: { id: authorId } },
        order: idx,
      })),
    };
  }

  // Главный + лента
  const hasMainField = formData.get("main") !== null;
  const hasGalleryField = formData.get("gallery") !== null;

  if (hasMainField || hasGalleryField) {
    const mainId = parseIdObjectJSON(formData.get("main"));
    const galleryIds = uniq(parseIdArrayJSON(formData.get("gallery"))).filter(
      (mid) => mid !== mainId
    );

    await prisma.articleMedia.deleteMany({ where: { articleId: id } });

    const mediaCreate: Array<{ mediaId: string; role: "BODY" | "GALLERY"; order: number }> = [];
    if (mainId) mediaCreate.push({ mediaId: mainId, role: "BODY", order: 0 });
    galleryIds.forEach((mid, idx) =>
      mediaCreate.push({ mediaId: mid, role: "GALLERY", order: idx })
    );

    if (mediaCreate.length) {
      patch.media = {
        create: mediaCreate.map((m) => ({
          role: m.role,
          order: m.order,
          media: { connect: { id: m.mediaId } },
        })),
      };
    }
  }

  // 🔹 ВАЖНО: чекбоксы. ЯВНО присваиваем флаги, чтобы "снятый" чекбокс сохранился как false.
  patch.commentsEnabled = formData.get("commentsEnabled") === "on";
  patch.commentsGuestsAllowed = formData.get("commentsGuestsAllowed") === "on";

  let updatedSlug: string | undefined;
  try {
    const res = await prisma.article.update({
      where: { id },
      data: patch,
      select: { slug: true },
    });
    updatedSlug = res.slug;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const f = fieldOfP2002(err);
      const msg =
        f === "title"
          ? "Заголовок уже занят"
          : f === "slug"
          ? "Slug уже занят"
          : "Уникальное поле уже занято";
      redirect(`/admin/articles/${id}?error=${encodeURIComponent(msg)}&field=${f}`);
    }
    console.error("[updateArticle] error:", err);
    redirect(`/admin/articles/${id}?error=${encodeURIComponent("Ошибка сохранения")}`);
  }

  revalidatePath("/");
  revalidatePath(`/news/${encodeURIComponent(updatedSlug!)}`);
  revalidatePath(`/admin/articles`);
  redirect(`/admin/articles/${id}?toast=${encodeURIComponent("Сохранено")}`);
}

// ───────────────────────────────────────────────────────────────
// PUBLISH / UNPUBLISH / DELETE
export async function publishArticle(id: string) {
  await requireRole(["EDITOR", "ADMIN"]);
  const a = await prisma.article.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
    select: { slug: true },
  });
  revalidatePath("/");
  revalidatePath(`/news/${encodeURIComponent(a.slug)}`);
  revalidatePath(`/admin/articles`);
  redirect(`/admin/articles/${id}?toast=${encodeURIComponent("Опубликовано")}`);
}

export async function unpublishArticle(id: string) {
  await requireRole(["EDITOR", "ADMIN"]);
  const a = await prisma.article.update({
    where: { id },
    data: { status: "DRAFT", publishedAt: null },
    select: { slug: true },
  });
  revalidatePath("/");
  revalidatePath(`/news/${encodeURIComponent(a.slug)}`);
  revalidatePath(`/admin/articles`);
  redirect(`/admin/articles/${id}?toast=${encodeURIComponent("Снято с публикации")}`);
}

export async function deleteArticle(id: string) {
  await requireRole(["EDITOR", "ADMIN"]);
  await prisma.article.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/admin/articles");
  redirect(`/admin/articles?toast=${encodeURIComponent("Статья удалена")}`);
}
