# Этап 1: Установка зависимостей
FROM node:20-alpine AS deps
WORKDIR /app

# Устанавливаем pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Копируем файлы для установки зависимостей
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Устанавливаем зависимости
RUN pnpm install --frozen-lockfile

# Генерируем Prisma Client
RUN npx prisma generate

# Этап 2: Сборка приложения
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Копируем зависимости из предыдущего этапа
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Копируем исходный код
COPY . .

# Создаем .env для сборки (если нужно)
ARG NEXT_PUBLIC_AUTH_VK_REDIRECT_URI
ENV NEXT_PUBLIC_AUTH_VK_REDIRECT_URI=$NEXT_PUBLIC_AUTH_VK_REDIRECT_URI

# Собираем приложение
RUN pnpm build

# Этап 3: Production образ
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

# Создаем непривилегированного пользователя
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Копируем необходимые файлы
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Копируем собранное приложение
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# Открываем порт
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

USER nextjs

CMD ["node_modules/.bin/next", "start"]