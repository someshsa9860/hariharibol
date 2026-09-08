# One image, four containers.
#
# The API, the worker, the websocket server and the deeplink service all run
# from this image with a different command (see docker-compose.yml). They share
# every dependency and the whole Prisma client, so building four near-identical
# images would mean four builds, four pushes and four chances for them to drift
# out of sync with each other.
#
# They are still separate containers, which is the part that matters: each
# scales, restarts and fails on its own.

FROM node:22-alpine AS deps
WORKDIR /app

# Prisma needs OpenSSL to pick its query engine on Alpine.
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl tini

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Never run as root. The image contains signing keys' worth of trust; a process
# that does not need write access to it should not have it.
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 4000

# tini reaps zombies and forwards SIGTERM, which is what makes the graceful
# shutdown in server.js actually run on a container stop.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
