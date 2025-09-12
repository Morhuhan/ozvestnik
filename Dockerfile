FROM base AS runner
WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

COPY --from=builder /app/lib ./lib
COPY --from=builder /app/tsconfig.json ./tsconfig.json

COPY --from=builder /app/package.json ./package.json

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
