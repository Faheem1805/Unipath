FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY shared/package.json shared/package.json
COPY database database
RUN pnpm install --frozen-lockfile
COPY shared shared
COPY backend backend
RUN pnpm db:generate && pnpm --filter @unipath/shared build && pnpm --filter @unipath/backend build

# The migration job is a separate image target. API replicas never migrate.
FROM build AS migrate
USER node
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy --schema database/schema.prisma && node node_modules/tsx/dist/cli.mjs backend/src/seed.ts"]

FROM base AS production-deps
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY shared/package.json shared/package.json
COPY database database
RUN pnpm install --prod --frozen-lockfile

FROM base AS runtime
ENV NODE_ENV=production PORT=3001
COPY --from=production-deps --chown=node:node /app /app
COPY --from=build --chown=node:node /app/shared/dist /app/shared/dist
COPY --from=build --chown=node:node /app/backend/dist /app/backend/dist
COPY --from=build --chown=node:node /app/backend/generated /app/backend/generated
USER node
EXPOSE 3001
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/dist/server.js"]

