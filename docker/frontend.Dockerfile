FROM node:22-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY shared/package.json shared/package.json
RUN pnpm install --frozen-lockfile
COPY shared shared
COPY frontend frontend
RUN pnpm --filter @unipath/shared build && pnpm --filter @unipath/frontend build

FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime
ENV API_UPSTREAM=backend:3001 NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/health/web || exit 1

