# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# ── Stage 2: production ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nodejs

COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/.next ./.next
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node_modules/.bin/next", "start"]
