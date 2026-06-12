# syntax=docker/dockerfile:1

# Debian slim (glibc) base — sharp + prisma engines ship prebuilt glibc binaries,
# so no native compilation is needed. openssl is required by the prisma engines.
FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- deps: install full dependency tree (cached on lockfile) ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: generate prisma client, then build the standalone output ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy build-time values: prisma.config reads DATABASE_URL on load, and the OpenAI
# client is constructed at module import during page-data collection. No DB/API is touched.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV OPENAI_API_KEY=sk-build-placeholder
# Prisma client is gitignored (output -> lib/generated/prisma); generate it before the build.
RUN npx prisma generate
RUN npm run build

# --- prisma-cli: isolated install of just the prisma CLI with its full transitive
#     dep tree (effect, @prisma/config, engines, ...) so `migrate deploy` runs standalone.
#     Version pinned to the prisma in package.json to match the committed migrations. ---
FROM base AS prisma-cli
WORKDIR /prisma-cli
RUN npm install --omit=dev --no-package-lock prisma@6.19.3

# --- runner: minimal runtime image ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# App writes generated images here; mounted as a volume in compose.
ENV STORAGE_DIR=/app/storage

# Standalone server + assets it does not copy by default.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Generated prisma client (incl. linux query-engine .node) used at runtime.
COPY --from=builder /app/lib/generated/prisma ./lib/generated/prisma

# Prisma CLI (full dep tree) + schema so the entrypoint can run `migrate deploy` at startup.
COPY --from=prisma-cli /prisma-cli/node_modules ./prisma-cli/node_modules
COPY --from=builder /app/prisma ./prisma

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /app/storage \
  && chown -R node:node /app

USER node
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
