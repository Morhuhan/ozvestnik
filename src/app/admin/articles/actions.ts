"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../../../../lib/db";
import { requireRole } from "../../../../lib/session";
import { slugify } from "../../../../lib/slugify";

export type CreateArticleState = {
  ok: boolean;
  error?: string;
  field?: "title" | "slug" | "subtitle" | "body" | "unknown";
};

export type UpdateArticleState = {
  ok: boolean;
  error?: string;
  field?: "title" | "slug" | "subtitle" | "body" | "unknown";
};

const BaseArticleSchema = z.object({
  title: z.preprocess(
    (v) => (v == null ? "" : v),
    z
      .string()
      .trim()
      .min(1, "Введите заголовок")
      .min(10, "Заголовок слишком короткий (минимум 10 символов)")
      .max(100, "Заголовок слишком длинный (максимум 100 символов)")
  ),
  subtitle: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .trim()
      .min(10, "Подзаголовок слишком короткий (минимум 10 символов)")
      .max(100, "Подзаголовок слишком длинный (максимум 100 символов)")
      .optional()
      .nullable()
  ),
  body: z.preprocess((v) => (v == null ? "" : v), z.string()).optional(),
});

const UpdateArticleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Введите заголовок")
    .min(10, "Заголовок слишком короткий (минимум 10 символов)")
    .max(100, "Заголовок слишком длинный (максимум 100 символов)")
    .optional(),
  subtitle: z
    .union([
      z
        .string()
        .trim()
        .min(10, "Подзаголовок слишком короткий (минимум 10 символов)")
        .max(100, "Подзаголовок слишком длинный (максимум 100 символов)"),
      z.literal(""),
    ])
    .optional(),
  body: z.string().optional(),
});

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

function zodToState(
  e: z.ZodError
): { error: string; field: "title" | "slug" | "subtitle" | "body" | "unknown" } {
  const issue = e.issues[0];
  const path0 = String(issue?.path?.[0] ?? "unknown");
  const field = (["title", "slug", "subtitle", "body"] as const).includes(path0 as any)
    ? (path0 as any)
    : "unknown";
  return { error: issue?.message || "Ошибка валидации", field };
}

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

function parseContentJson(raw: FormDataEntryValue | null | undefined): any | null {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (!str || str.toLowerCase() === "null") return null;
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
      return parsed;
    }
  } catch {}
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

export async function createArticle(
  _prev: CreateArticleState | undefined,
  formData: FormData
): Promise<CreateArticleState> {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  let created: { id: string; slug: string } | undefined;

  try {
    const base = BaseArticleSchema.parse({
      title: formData.get("title"),
      subtitle: formData.get("subtitle") || null,
      body: formData.get("body") ?? "",
    });

    const slug = slugify(String(formData.get("slug") || base.title));

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

    const contentJsonFromForm = parseContentJson(formData.get("contentJson"));
    const bodyPlain = String(base.body || "");
    const content = contentJsonFromForm ?? textToTiptapJSON(bodyPlain);

    const plainFromContent = bodyPlain.trim() || tiptapJSONToPlain(content).trim();
    if (!plainFromContent) {
      return { ok: false, error: "Введите текст статьи", field: "body" };
    }

    const excerpt = plainFromContent.slice(0, 200);

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
    if (err instanceof z.ZodError) {
      const { error, field } = zodToState(err);
      return { ok: false, error, field };
    }
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

  revalidatePath("/");
  revalidatePath(`/news/${encodeURIComponent(created!.slug)}`);
  revalidatePath(`/admin/articles`);
  redirect(`/admin/articles/${created!.id}?toast=${encodeURIComponent("Черновик создан")}`);
}

export async function updateArticle(
  id: string,
  _prev: UpdateArticleState | undefined,
  formData: FormData
): Promise<UpdateArticleState> {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  let data: z.infer<typeof UpdateArticleSchema>;
  try {
    data = UpdateArticleSchema.parse({
      title: formData.get("title") ?? undefined,
      subtitle: formData.get("subtitle") ?? undefined,
      body: formData.get("body") ?? undefined,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const { error, field } = zodToState(err);
      return { ok: false, error, field };
    }
    return { ok: false, error: "Ошибка валидации", field: "unknown" };
  }

  const patch: any = {};

  if (data.title !== undefined) {
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

  if (data.subtitle !== undefined) patch.subtitle = data.subtitle === "" ? null : data.subtitle;

  const contentJsonRaw = formData.get("contentJson");
  const contentJson = parseContentJson(contentJsonRaw);
  let effectiveContent: any | null = null;

  if (contentJson) {
    patch.content = contentJson;
    effectiveContent = contentJson;
  } else if (data.body !== undefined) {
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
      const res = await tx.article.update({
        where: { id },
        data: patch,
        select: { slug: true },
      });
      updatedSlug = res.slug;

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

  revalidatePath("/");
  if (updatedSlug) revalidatePath(`/news/${encodeURIComponent(updatedSlug)}`);
  revalidatePath(`/admin/articles`);
  redirect(`/admin/articles/${id}?toast=${encodeURIComponent("Сохранено")}`);
}

export async function updateAndPublishArticle(
  id: string,
  _prev: UpdateArticleState | undefined,
  formData: FormData
): Promise<UpdateArticleState> {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  let data: z.infer<typeof BaseArticleSchema>;
  try {
    data = BaseArticleSchema.parse({
      title: formData.get("title"),
      subtitle: formData.get("subtitle") || undefined,
      body: formData.get("body") || undefined,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const { error, field } = zodToState(err);
      return { ok: false, error, field };
    }
    return { ok: false, error: "Ошибка валидации", field: "unknown" };
  }

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
      const res = await tx.article.update({
        where: { id },
        data: patch,
        select: { slug: true },
      });
      updatedSlug = res.slug;

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

  revalidatePath("/");
  if (updatedSlug) revalidatePath(`/news/${encodeURIComponent(updatedSlug)}`);
  revalidatePath(`/admin/articles`);
  redirect(`/admin/articles/${id}?toast=${encodeURIComponent("Опубликовано")}`);
}

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

export async function setArticleCarouselDirect(id: string, inCarousel: boolean) {
  await requireRole(["EDITOR", "ADMIN"]);

  if (!id) return { ok: false as const, error: "no_id" };

  const a = await prisma.article.findUnique({
    where: { id },
    select: { id: true, status: true, publishedAt: true },
  });
  if (!a) return { ok: false as const, error: "not_found" };

  if (inCarousel && (a.status !== "PUBLISHED" || !a.publishedAt)) {
    return { ok: false as const, error: "not_published" };
  }

  await prisma.article.update({
    where: { id },
    data: { inCarousel },
  });

  revalidatePath("/admin/articles");
  revalidatePath("/");

  return { ok: true as const, inCarousel };
}
