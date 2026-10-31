# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm exec nuxt prepare && pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/.output ./.output
# Uploaded pages live here. Coolify mounts a named volume on this folder, and a
# new volume takes its owner from the image, so the app can write to it.
RUN mkdir -p .data/blogs && chown -R node:node .data
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 CMD curl -fsS http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", ".output/server/index.mjs"]
