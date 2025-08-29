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
// Тип состояния для React.useActionState
export type CreateArticleState = {
  ok: boolean;
  error?: string;
  field?: "title" | "slug" | "body" | "unknown";
};

export type UpdateArticleState = {
  ok: boolean;
  error?: string;
  field?: "title" | "slug" | "body" | "unknown";
};

// ───────────────────────────────────────────────────────────────
// Schemas
const BaseArticleSchema = z.object({
  title: z.string().min(3),
  subtitle: z.string().max(300).optional().nullable(),
  body: z.string().optional().default(""),
});

// ───────────────────────────────────────────────────────────────
// Helpers
type AuthorInput =
  | { id: string }
  | { lastName: string; firstName: string; patronymic?: string | null };

function textToTiptapJSON(text: string) {
  const paras = String(text || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    type: "doc",
    content: paras.length
      ? paras.map((p) => ({
          type: "paragraph",
          content: [{ type: "text", text: p }],
        }))
      : [{ type: "paragraph" }],
  };
}

/** Простой plain-экстрактор из tiptap JSON, чтобы сделать excerpt */
function tiptapJSONToPlain(input: any): string {
  try {
    const blocks: any[] = Array.isArray(input?.content) ? input.content : [];
    const paras = blocks.map((node) => {
      const texts = Array.isArray(node?.content)
        ? node.content
            .map((t: any) => (typeof t?.text === "string" ? t.text : ""))
            .join("")
        : "";
      return texts.trim();
    });
    return paras.filter(Boolean).join("\n\n");
  } catch {
    return "";
  }
}

/** Пытаемся распарсить contentJson из формы */
function parseContentJson(raw: FormDataEntryValue | null | undefined): any | null {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (!str || str.toLowerCase() === "null") return null;
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
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
// CREATE — для React.useActionState: ошибки возвращаем, успех — redirect
export async function createArticle(
  _prev: CreateArticleState | undefined,
  formData: FormData
): Promise<CreateArticleState> {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  let created: { id: string; slug: string } | undefined;

  try {
    // 1) Базовые поля
    const base = BaseArticleSchema.parse({
      title: formData.get("title"),
      subtitle: formData.get("subtitle") || null,
      body: formData.get("body") ?? "",
    });

    const slug = slugify(String(formData.get("slug") || base.title));

    // 2) Пред-проверка уникальности
    const conflict = await prisma.article.findFirst({
      where: { OR: [{ title: base.title }, { slug }] },
      select: { title: true, slug: true },
    });
    if (conflict?.title === base.title) {
      return { ok: false, error: "Заголовок уже занят", field: "title" };
    }
    if (conflict?.slug === slug) {
      return { ok: false, error: "Slug уже занят", field: "slug" };
    }

    // 3) Контент
    const contentJsonFromForm = parseContentJson(formData.get("contentJson"));
    const bodyPlain = String(base.body || "");
    const content = contentJsonFromForm ?? textToTiptapJSON(bodyPlain);

    // 4) Наличие текста
    const plainFromContent = bodyPlain.trim() || tiptapJSONToPlain(content).trim();
    if (!plainFromContent) {
      return { ok: false, error: "Введите текст статьи", field: "body" };
    }

    // 5) excerpt
    const excerpt = plainFromContent.slice(0, 200);

    // 6) Связанные поля
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

    // inline-изображения из контента
    const extractInlineMediaIdsFromContent = (json: any): string[] => {
      const acc: string[] = [];
      const walk = (node: any) => {
        if (!node || typeof node !== "object") return;
        if (node.type === "image" && node.attrs?.["data-media-id"]) {
          acc.push(String(node.attrs["data-media-id"]));
        }
        const kids = Array.isArray(node?.content) ? node.content : [];
        kids.forEach(walk);
      };
      walk(json);
      return Array.from(new Set(acc));
    };
    const inlineIds = extractInlineMediaIdsFromContent(content);

    const commentsEnabled = formData.get("commentsEnabled") === "on";
    const commentsGuestsAllowed = formData.get("commentsGuestsAllowed") === "on";

    // 7) Транзакция
    await prisma.$transaction(async (tx) => {
      created = await tx.article.create({
        data: {
          slug,
          title: base.title,
          subtitle: base.subtitle || undefined,
          status: "DRAFT",
          sectionId,
          content,
          excerpt,

          coverMediaId: coverId ?? null,
          coverUrl: coverId ? `/admin/media/${coverId}/raw` : null,

          tags: { create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) },
          authors: { create: authorCreate },

          commentsEnabled,
          commentsGuestsAllowed,
        },
        select: { id: true, slug: true },
      });

      const mediaCreate: Array<{
        mediaId: string;
        role: "BODY" | "GALLERY" | "INLINE";
        order: number;
      }> = [];
      if (mainId) mediaCreate.push({ mediaId: mainId, role: "BODY", order: 0 });
      galleryIds.forEach((id, idx) =>
        mediaCreate.push({ mediaId: id, role: "GALLERY", order: idx })
      );
      inlineIds.forEach((id, idx) =>
        mediaCreate.push({ mediaId: id, role: "INLINE", order: idx })
      );

      if (mediaCreate.length) {
        await tx.articleMedia.createMany({
          data: mediaCreate.map((m) => ({
            articleId: created!.id,
            mediaId: m.mediaId,
            role: m.role,
            order: m.order,
          })),
          skipDuplicates: true,
        });
      }
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
      return { ok: false, error: msg, field: f };
    }
    console.error("[createArticle] error:", err);
    return { ok: false, error: "Ошибка сохранения", field: "unknown" };
  }

  // Успех: инвалидация + редирект (исключение уйдёт мимо catch)
  revalidatePath("/");
  revalidatePath(`/news/${encodeURIComponent(created!.slug)}`);
  revalidatePath(`/admin/articles`);
  redirect(`/admin/articles/${created!.id}?toast=${encodeURIComponent("Черновик создан")}`);
}

// ───────────────────────────────────────────────────────────────
// UPDATE — версия для React.useActionState
export async function updateArticle(
  id: string,
  _prev: UpdateArticleState | undefined,
  formData: FormData
): Promise<UpdateArticleState> {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  // собираем патч как раньше
  const data = BaseArticleSchema.partial().parse({
    title: formData.get("title") || undefined,
    subtitle: formData.get("subtitle") || undefined,
    body: formData.get("body") || undefined,
  });

  const patch: any = {};

  // title
  if (data.title) {
    const tConflict = await prisma.article.findFirst({
      where: { title: data.title, NOT: { id } },
      select: { id: true },
    });
    if (tConflict) {
      return { ok: false, error: "Заголовок уже занят", field: "title" };
    }
    patch.title = data.title;
  }

  // slug
  const rawSlug = String(formData.get("slug") ?? "").trim();
  if (rawSlug) {
    const norm = slugify(rawSlug);
    const sConflict = await prisma.article.findFirst({
      where: { slug: norm, NOT: { id } },
      select: { id: true },
    });
    if (sConflict) {
      return { ok: false, error: "Slug уже занят", field: "slug" };
    }
    patch.slug = norm;
  }

  if (data.subtitle !== undefined) patch.subtitle = data.subtitle || null;

  // контент: либо JSON, либо fallback из plain
  const contentJsonRaw = formData.get("contentJson");
  const contentJson = parseContentJson(contentJsonRaw);
  let effectiveContent: any | null = null;

  if (contentJson) {
    patch.content = contentJson;
    effectiveContent = contentJson;
  } else if (data.body) {
    const fromPlain = textToTiptapJSON(data.body);
    patch.content = fromPlain;
    effectiveContent = fromPlain;
  }

  // excerpt: из body либо из JSON
  if (data.body !== undefined) {
    patch.excerpt = (data.body || "").slice(0, 200);
  } else if (contentJson) {
    const plain = tiptapJSONToPlain(contentJson);
    patch.excerpt = plain.slice(0, 200);
  }

  // Раздел
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

  // чекбоксы комментариев — задаём явно
  patch.commentsEnabled = formData.get("commentsEnabled") === "on";
  patch.commentsGuestsAllowed = formData.get("commentsGuestsAllowed") === "on";

  // Теги/авторы — пересоздание связей при наличии полей
  const tagsFieldPresent = formData.get("tags") !== null;
  const authorsFieldPresent = formData.get("authors") !== null;

  // Главный / Галерея — пересобираем только эти роли (INLINE не трогаем здесь)
  const hasMainField = formData.get("main") !== null;
  const hasGalleryField = formData.get("gallery") !== null;

  // ⬇️ извлекаем inline из итогового контента (если он менялся в этой операции)
  const extractInlineMediaIdsFromContent = (json: any): string[] => {
    if (!json) return [];
    const acc: string[] = [];
    const walk = (node: any) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "image" && node.attrs?.["data-media-id"]) {
        acc.push(String(node.attrs["data-media-id"]));
      }
      const kids = Array.isArray(node?.content) ? node.content : [];
      kids.forEach(walk);
    };
    walk(json);
    return Array.from(new Set(acc));
  };
  const inlineIdsToSync = effectiveContent ? extractInlineMediaIdsFromContent(effectiveContent) : null;

  let updatedSlug: string | undefined;

  try {
    await prisma.$transaction(async (tx) => {
      // 1) обновляем саму статью
      const res = await tx.article.update({
        where: { id },
        data: patch,
        select: { slug: true },
      });
      updatedSlug = res.slug;

      // 2) Теги
      if (tagsFieldPresent) {
        const tagIds = parseIdArrayJSON(formData.get("tags"));
        await tx.tagOnArticle.deleteMany({ where: { articleId: id } });
        if (tagIds.length) {
          await tx.tagOnArticle.createMany({
            data: tagIds.map((tagId) => ({ articleId: id, tagId })),
            skipDuplicates: true,
          });
        }
      }

      // 3) Авторы
      if (authorsFieldPresent) {
        const authorIds = await ensureAuthorIdsFromForm(formData.get("authors"));
        await tx.authorOnArticle.deleteMany({ where: { articleId: id } });
        if (authorIds.length) {
          await tx.authorOnArticle.createMany({
            data: authorIds.map((authorId, idx) => ({
              articleId: id,
              authorId,
              order: idx,
            })),
            skipDuplicates: true,
          });
        }
      }

      // 4) BODY + GALLERY
      if (hasMainField || hasGalleryField) {
        const mainId = parseIdObjectJSON(formData.get("main"));
        const galleryIds = uniq(parseIdArrayJSON(formData.get("gallery"))).filter(
          (mid) => mid !== mainId
        );

        await tx.articleMedia.deleteMany({
          where: { articleId: id, role: { in: ["BODY", "GALLERY"] } as any },
        });

        const mediaCreateBG: Array<{ mediaId: string; role: "BODY" | "GALLERY"; order: number }> = [];
        if (mainId) mediaCreateBG.push({ mediaId: mainId, role: "BODY", order: 0 });
        galleryIds.forEach((mid, idx) =>
          mediaCreateBG.push({ mediaId: mid, role: "GALLERY", order: idx })
        );

        if (mediaCreateBG.length) {
          await tx.articleMedia.createMany({
            data: mediaCreateBG.map((m) => ({
              articleId: id,
              mediaId: m.mediaId,
              role: m.role,
              order: m.order,
            })),
            skipDuplicates: true,
          });
        }
      }

      // 5) INLINE — пересинхронизируем, только если контент менялся
      if (inlineIdsToSync) {
        await tx.articleMedia.deleteMany({ where: { articleId: id, role: "INLINE" as any } });
        if (inlineIdsToSync.length) {
          await tx.articleMedia.createMany({
            data: inlineIdsToSync.map((mediaId, idx) => ({
              articleId: id,
              mediaId,
              role: "INLINE",
              order: idx,
            })),
            skipDuplicates: true,
          });
        }
      }
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
      return { ok: false, error: msg, field: f };
    }
    console.error("[updateArticle] error:", err);
    return { ok: false, error: "Ошибка сохранения", field: "unknown" };
  }

  // успех → инвалидации и редирект с тостом на ту же страницу
  revalidatePath("/");
  if (updatedSlug) revalidatePath(`/news/${encodeURIComponent(updatedSlug)}`);
  revalidatePath(`/admin/articles`);
  redirect(`/admin/articles/${id}?toast=${encodeURIComponent("Сохранено")}`);
}

// ───────────────────────────────────────────────────────────────
// UPDATE + PUBLISH — для React.useActionState (в одной форме)
export async function updateAndPublishArticle(
  id: string,
  _prev: UpdateArticleState | undefined,
  formData: FormData
): Promise<UpdateArticleState> {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  // используем ту же логику сборки патча, что и в updateArticle
  const BaseArticleSchema = z.object({
    title: z.string().min(3).optional(),
    subtitle: z.string().max(300).optional().nullable(),
    body: z.string().optional(),
  });
  const data = BaseArticleSchema.parse({
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
      return { ok: false, error: "Заголовок уже занят", field: "title" };
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
      return { ok: false, error: "Slug уже занят", field: "slug" };
    }
    patch.slug = norm;
  }

  if (data.subtitle !== undefined) patch.subtitle = data.subtitle || null;

  const contentJsonRaw = formData.get("contentJson");
  const contentJson = parseContentJson(contentJsonRaw);
  let effectiveContent: any | null = null;

  if (contentJson) {
    patch.content = contentJson;
    effectiveContent = contentJson;
  } else if (data.body) {
    const fromPlain = textToTiptapJSON(data.body);
    patch.content = fromPlain;
    effectiveContent = fromPlain;
  }

  if (data.body !== undefined) {
    patch.excerpt = (data.body || "").slice(0, 200);
  } else if (contentJson) {
    const plain = tiptapJSONToPlain(contentJson);
    patch.excerpt = plain.slice(0, 200);
  }

  const sectionId = parseIdObjectJSON(formData.get("section"));
  patch.sectionId = sectionId;

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

  patch.commentsEnabled = formData.get("commentsEnabled") === "on";
  patch.commentsGuestsAllowed = formData.get("commentsGuestsAllowed") === "on";

  const tagsFieldPresent = formData.get("tags") !== null;
  const authorsFieldPresent = formData.get("authors") !== null;
  const hasMainField = formData.get("main") !== null;
  const hasGalleryField = formData.get("gallery") !== null;

  const extractInlineMediaIdsFromContent = (json: any): string[] => {
    if (!json) return [];
    const acc: string[] = [];
    const walk = (node: any) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "image" && node.attrs?.["data-media-id"]) {
        acc.push(String(node.attrs["data-media-id"]));
      }
      const kids = Array.isArray(node?.content) ? node.content : [];
      kids.forEach(walk);
    };
    walk(json);
    return Array.from(new Set(acc));
  };
  const inlineIdsToSync = effectiveContent ? extractInlineMediaIdsFromContent(effectiveContent) : null;

  let updatedSlug: string | undefined;

  try {
    await prisma.$transaction(async (tx) => {
      // 1) обновляем статью (контент/метаданные)
      const res = await tx.article.update({
        where: { id },
        data: patch,
        select: { slug: true },
      });
      updatedSlug = res.slug;

      // 2) теги
      if (tagsFieldPresent) {
        const tagIds = parseIdArrayJSON(formData.get("tags"));
        await tx.tagOnArticle.deleteMany({ where: { articleId: id } });
        if (tagIds.length) {
          await tx.tagOnArticle.createMany({
            data: tagIds.map((tagId) => ({ articleId: id, tagId })),
            skipDuplicates: true,
          });
        }
      }

      // 3) авторы
      if (authorsFieldPresent) {
        const authorIds = await ensureAuthorIdsFromForm(formData.get("authors"));
        await tx.authorOnArticle.deleteMany({ where: { articleId: id } });
        if (authorIds.length) {
          await tx.authorOnArticle.createMany({
            data: authorIds.map((authorId, idx) => ({
              articleId: id,
              authorId,
              order: idx,
            })),
            skipDuplicates: true,
          });
        }
      }

      // 4) BODY + GALLERY
      if (hasMainField || hasGalleryField) {
        const mainId = parseIdObjectJSON(formData.get("main"));
        const galleryIds = uniq(parseIdArrayJSON(formData.get("gallery"))).filter(
          (mid) => mid !== mainId
        );

        await tx.articleMedia.deleteMany({
          where: { articleId: id, role: { in: ["BODY", "GALLERY"] } as any },
        });

        const mediaCreateBG: Array<{ mediaId: string; role: "BODY" | "GALLERY"; order: number }> = [];
        if (mainId) mediaCreateBG.push({ mediaId: mainId, role: "BODY", order: 0 });
        galleryIds.forEach((mid, idx) =>
          mediaCreateBG.push({ mediaId: mid, role: "GALLERY", order: idx })
        );

        if (mediaCreateBG.length) {
          await tx.articleMedia.createMany({
            data: mediaCreateBG.map((m) => ({
              articleId: id,
              mediaId: m.mediaId,
              role: m.role,
              order: m.order,
            })),
            skipDuplicates: true,
          });
        }
      }

      // 5) INLINE
      if (inlineIdsToSync) {
        await tx.articleMedia.deleteMany({ where: { articleId: id, role: "INLINE" as any } });
        if (inlineIdsToSync.length) {
          await tx.articleMedia.createMany({
            data: inlineIdsToSync.map((mediaId, idx) => ({
              articleId: id,
              mediaId,
              role: "INLINE",
              order: idx,
            })),
            skipDuplicates: true,
          });
        }
      }

      // 6) собственно публикация
      await tx.article.update({
        where: { id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
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
      return { ok: false, error: msg, field: f };
    }
    console.error("[updateAndPublishArticle] error:", err);
    return { ok: false, error: "Ошибка сохранения", field: "unknown" };
  }

  // успех → инвалидации + редирект с тостом
  revalidatePath("/");
  if (updatedSlug) revalidatePath(`/news/${encodeURIComponent(updatedSlug)}`);
  revalidatePath(`/admin/articles`);
  redirect(`/admin/articles/${id}?toast=${encodeURIComponent("Опубликовано")}`);
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
