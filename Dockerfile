# --- Base layer: Node + OpenSSL (нужен для Prisma) ---
FROM node:20-bookworm-slim AS base
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# --- Builder: собираем приложение и генерируем Prisma Client ---
FROM base AS builder
WORKDIR /app
RUN corepack enable

# PNPM deps (кэшируем store)
COPY pnpm-lock.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch

# Код + офлайн установка зависимостей
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --prefer-offline

# Генерация Prisma Client (подтянет нужные движки в node_modules/.pnpm)
RUN pnpm prisma generate

# Сборка Next.js (standalone)
RUN pnpm build

# --- Runner: тонкий рантайм-образ ---
FROM base AS runner
WORKDIR /app

# Приложение (standalone), статика и public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# ВАЖНО: копируем целиком node_modules (включая .pnpm, .bin, @prisma/*, движки и т.д.)
COPY --from=builder /app/node_modules ./node_modules

# Prisma схема и скрипты
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# package.json для require.resolve и prisma.schema
COPY --from=builder /app/package.json ./package.json

ENV PORT=3000
EXPOSE 3000

# Миграции выполняем в docker-compose; здесь только сервер
CMD ["node", "server.js"]
