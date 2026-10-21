# The website: a Next.js server (next.config.ts sets output: 'standalone') in one small image.
#
# Anything starting NEXT_PUBLIC_ is written into the browser bundle by `next build`, so those values are build
# arguments, not settings of the running container (see .github/workflows/deploy-website.yml). The three URLs
# default to production, as lib/config.ts does, because an empty value would not fall back to that default.
# What the server itself reads when it runs (API_BASE_URL) is set by deploy/server/website.sh.

FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

ARG NEXT_PUBLIC_SITE_URL=https://hariharibol.com
ARG NEXT_PUBLIC_API_BASE_URL=https://api.hariharibol.com
ARG NEXT_PUBLIC_APPLE_REDIRECT_URI=https://hariharibol.com/
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_APPLE_CLIENT_ID
ARG NEXT_PUBLIC_FIREBASE_CONFIG
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_APPLE_REDIRECT_URI=$NEXT_PUBLIC_APPLE_REDIRECT_URI \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_APPLE_CLIENT_ID=$NEXT_PUBLIC_APPLE_CLIENT_ID \
    NEXT_PUBLIC_FIREBASE_CONFIG=$NEXT_PUBLIC_FIREBASE_CONFIG \
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY \
    NEXT_TELEMETRY_DISABLED=1

# next build, then scripts/standalone.mjs puts .next/static and public/ beside server.js.
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Owned by the unprivileged user the node image provides: Next writes its data cache under .next/cache as it runs.
COPY --from=build --chown=node:node /app/.next/standalone ./
USER node

EXPOSE 3000

# tini forwards SIGTERM, so `docker stop` ends the server at once instead of waiting out the timeout.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
