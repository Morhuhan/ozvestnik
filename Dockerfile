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

COPY pnpm-lock.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --prefer-offline

# Генерируем Prisma Client
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

# Prisma: схема + клиентские бинари + CLI
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Скрипты (например, scripts/create-admin.js)
COPY --from=builder /app/scripts ./scripts

# package.json нужен для require.resolve/npx и для prisma.schema пути
COPY --from=builder /app/package.json ./package.json

ENV PORT=3000
EXPOSE 3000

# Миграции выполняются в docker-compose командой; здесь просто запуск сервера
CMD ["node", "server.js"]
