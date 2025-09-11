# syntax=docker/dockerfile:1.7

########################
# Base (pnpm enabled)
########################
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Инструменты для нативных модулей (sharp/bcrypt) и Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# (Опционально) в CI часто не нужны браузеры playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

########################
# Dependencies layer
########################
FROM base AS deps
WORKDIR /app

# 1) максимально кэшируемая часть
COPY pnpm-lock.yaml package.json ./

# 2) подтягиваем зависимости в локальный store с кэшем BuildKit
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch

# 3) докидываем остальной код
COPY . .

# 4) устанавливаем зависимости из store оффлайн
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline

########################
# Build layer
########################
FROM base AS builder
WORKDIR /app
COPY --from=deps /app /app
ENV NODE_ENV=production
RUN pnpm build

########################
# Runtime
########################
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Для Prisma/OpenSSL на Debian всё уже есть
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

CMD ["node", "server.js"]
