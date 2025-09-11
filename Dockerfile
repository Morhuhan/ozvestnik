FROM node:20-bookworm-slim AS base
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --prefer-offline

RUN pnpm prisma generate

RUN pnpm build

FROM base AS runner
WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

COPY --from=builder /app/package.json ./package.json

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
