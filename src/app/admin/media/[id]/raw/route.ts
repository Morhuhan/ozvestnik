// src/app/api/admin/media/[id]/raw/route.ts
// Если файл в src/app/api/admin/media/[id]/route.ts (без папки raw),
// используйте эти импорты:
// import { prisma } from "../../../../../../lib/db";
// import { ... } from "../../../../../../lib/yadisk";

import { NextRequest } from "next/server";
import { prisma } from "../../../../../../lib/db";
import { getPublicDownloadHref, getPrivateDownloadHref, publish, getResourceMeta } from "../../../../../../lib/yadisk";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Увеличиваем таймаут для больших файлов
export const maxDuration = 60;

type ParamsP = Promise<{ id: string }>;

// Таймаут для fetch запросов к Яндекс.Диску (в мс)
const FETCH_TIMEOUT = 30000;

// Кэш ссылок в памяти
const hrefCache = new Map<string, { href: string; expires: Date }>();

/**
 * Fetch с таймаутом
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = FETCH_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Получить ссылку для скачивания (из кэша или свежую)
 */
async function getCachedOrFreshHref(
  assetId: string,
  yandexPath: string,
  publicKey: string | null,
  dbDownloadHref: string | null,
  dbExpiresAt: Date | null,
  size?: string
): Promise<string> {
  const cacheKey = size ? `${assetId}:${size}` : assetId;
  const now = new Date();

  // Проверяем in-memory кэш
  const cached = hrefCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.href;
  }

  // Проверяем БД кэш (только для оригиналов без size)
  if (!size && dbDownloadHref && dbExpiresAt && dbExpiresAt > now) {
    hrefCache.set(cacheKey, { href: dbDownloadHref, expires: dbExpiresAt });
    return dbDownloadHref;
  }

  // Получаем свежую ссылку
  let href: string;

  if (publicKey) {
    href = await getPublicDownloadHref(publicKey);

    // Добавляем параметр size для preview
    if (size) {
      const url = new URL(href);
      url.searchParams.set("size", size);
      url.searchParams.delete("preview");
      href = url.toString();
    }
  } else {
    href = await getPrivateDownloadHref(yandexPath);

    if (size) {
      console.warn(
        `Preview requested for private resource ${assetId}, might not be available`
      );
    }
  }

  const expires = new Date(Date.now() + 23 * 60 * 60 * 1000);

  // Сохраняем в БД (только для оригиналов) - с await!
  if (!size) {
    try {
      await prisma.mediaAsset.update({
        where: { id: assetId },
        data: { downloadHref: href, downloadHrefExpiresAt: expires },
      });
    } catch (err) {
      console.error("Failed to cache download href:", err);
    }
  }

  hrefCache.set(cacheKey, { href, expires });
  return href;
}

/**
 * Публикует ресурс и возвращает publicKey
 */
async function ensurePublished(
  assetId: string,
  yandexPath: string
): Promise<string | null> {
  try {
    await publish(yandexPath);
    const meta: any = await getResourceMeta(yandexPath, "public_key");

    if (meta?.public_key) {
      const publicKey = String(meta.public_key);

      // Сохраняем в БД - с await!
      try {
        await prisma.mediaAsset.update({
          where: { id: assetId },
          data: { publicKey },
        });
      } catch (err) {
        console.error("Failed to save publicKey:", err);
      }

      return publicKey;
    }
  } catch (err) {
    console.error("Failed to publish resource:", err);
  }

  return null;
}

/**
 * Формирует ответ клиенту
 */
function buildResponse(
  upstream: Response,
  asset: { mime: string | null; filename: string; kind: string },
  range?: string,
  size?: string
) {
  const headers = new Headers();

  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") ??
      asset.mime ??
      "application/octet-stream"
  );

  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);

  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);

  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);

  headers.set(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(asset.filename)}"`
  );

  // Кэширование
  const maxAge = size
    ? 2592000 // 30 дней для превью
    : asset.kind === "IMAGE"
      ? 31536000 // 1 год для изображений
      : 3600; // 1 час для остального

  headers.set(
    "Cache-Control",
    size
      ? `public, max-age=${maxAge}, immutable`
      : asset.kind === "IMAGE"
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600, stale-while-revalidate=86400"
  );

  return new Response(upstream.body, {
    status: contentRange ? 206 : 200,
    headers,
  });
}

/**
 * Загружает файл с Яндекс.Диска с retry логикой
 */
async function fetchFromYandex(
  assetId: string,
  yandexPath: string,
  publicKey: string | null,
  dbDownloadHref: string | null,
  dbExpiresAt: Date | null,
  range?: string,
  size?: string
): Promise<Response> {
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Получаем ссылку (форсируем обновление при retry)
      let href: string;

      if (attempt === 0) {
        href = await getCachedOrFreshHref(
          assetId,
          yandexPath,
          publicKey,
          dbDownloadHref,
          dbExpiresAt,
          size
        );
      } else {
        // При retry получаем свежую ссылку напрямую
        console.log(`Retry ${attempt} for ${assetId}, getting fresh link`);

        if (publicKey) {
          href = await getPublicDownloadHref(publicKey);
          if (size) {
            const url = new URL(href);
            url.searchParams.set("size", size);
            href = url.toString();
          }
        } else {
          href = await getPrivateDownloadHref(yandexPath);
        }

        // Обновляем кэш
        const cacheKey = size ? `${assetId}:${size}` : assetId;
        const expires = new Date(Date.now() + 23 * 60 * 60 * 1000);
        hrefCache.set(cacheKey, { href, expires });
      }

      // Делаем запрос
      const upstream = await fetchWithTimeout(
        href,
        {
          headers: range ? { Range: range } : undefined,
          cache: "no-store",
        },
        FETCH_TIMEOUT
      );

      // Успешный ответ или частичный контент
      if (upstream.ok || upstream.status === 206) {
        return upstream;
      }

      // 401/403 - истекла ссылка, пробуем ещё раз
      if (
        (upstream.status === 401 || upstream.status === 403) &&
        attempt < maxRetries
      ) {
        console.log(`Link expired for ${assetId}, retrying...`);
        // Очищаем кэш
        const cacheKey = size ? `${assetId}:${size}` : assetId;
        hrefCache.delete(cacheKey);
        continue;
      }

      // 404/502 для preview - fallback на оригинал
      if (size && (upstream.status === 404 || upstream.status === 502)) {
        console.log(
          `Preview size=${size} not available for ${assetId}, using original`
        );
        return fetchFromYandex(
          assetId,
          yandexPath,
          publicKey,
          dbDownloadHref,
          dbExpiresAt,
          range
          // без size - оригинал
        );
      }

      // Другие ошибки
      throw new Error(`Upstream error: ${upstream.status}`);
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.error(`Timeout fetching media ${assetId}, attempt ${attempt}`);
        if (attempt < maxRetries) continue;
        throw new Error("Request timeout");
      }

      if (attempt < maxRetries) {
        console.error(`Error fetching ${assetId}, attempt ${attempt}:`, err);
        continue;
      }

      throw err;
    }
  }

  throw new Error("Max retries exceeded");
}

export async function GET(req: NextRequest, { params }: { params: ParamsP }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const size = searchParams.get("size") || undefined;

  // Получаем данные из БД
  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      mime: true,
      filename: true,
      yandexPath: true,
      publicKey: true,
      downloadHref: true,
      downloadHrefExpiresAt: true,
    },
  });

  if (!asset) {
    return new Response("Not found", { status: 404 });
  }

  if (size && asset.kind !== "IMAGE") {
    return new Response("Preview only available for images", { status: 400 });
  }

  // Публикуем ресурс если ещё не опубликован
  let publicKey = asset.publicKey;
  if (!publicKey) {
    publicKey = await ensurePublished(asset.id, asset.yandexPath);
  }

  try {
    const range = req.headers.get("range") ?? undefined;

    const upstream = await fetchFromYandex(
      asset.id,
      asset.yandexPath,
      publicKey,
      asset.downloadHref,
      asset.downloadHrefExpiresAt,
      range,
      size
    );

    return buildResponse(upstream, asset, range, size);
  } catch (error: any) {
    console.error("Error serving media:", error);

    if (error.message === "Request timeout") {
      return new Response("Gateway Timeout", { status: 504 });
    }

    return new Response(error.message || "Internal Server Error", {
      status: 502,
    });
  }
}