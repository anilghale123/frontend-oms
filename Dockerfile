# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `prepare` runs husky, which is neither needed nor installed in an image.
RUN npm ci --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public values are inlined into the browser bundle at build time, so they are build args.
# Server-only values (OMS_SALES_URL, TURNSTILE_SECRET_KEY) are read when the container starts, so
# they are set in the runner stage below, not here.
ARG NEXT_PUBLIC_EMBED_HOST_ORIGINS=https://fonepoints-business.vercel.app
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAFWJUF0XlUkrHdy7
ARG NEXT_PUBLIC_OMS_DEBUG
ENV NEXT_PUBLIC_EMBED_HOST_ORIGINS=$NEXT_PUBLIC_EMBED_HOST_ORIGINS
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_OMS_DEBUG=$NEXT_PUBLIC_OMS_DEBUG
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
# Server-only values, passed as build args and kept in the image environment.
ARG OMS_SALES_URL=https://uat-sales-api.providhy.com/
# This deployment's public origin: the same-origin check needs it behind the reverse proxy.
ARG OMS_PUBLIC_ORIGIN=
ARG TURNSTILE_SECRET_KEY=0x4AAAAAAFWJUBusHmfpj8JhRmJyBO3kBQQ
ENV OMS_SALES_URL=$OMS_SALES_URL \
    OMS_PUBLIC_ORIGIN=$OMS_PUBLIC_ORIGIN \
    TURNSTILE_SECRET_KEY=$TURNSTILE_SECRET_KEY
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
