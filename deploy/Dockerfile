# Production image for the web app (Next.js standalone output).
# Build from the repo root:  docker build -f deploy/Dockerfile -t pramana-web .
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
ENV NEXT_OUTPUT=standalone
RUN pnpm build

FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 \
    PRAMANA_ROOT=/app PRAMANA_DATA_DIR=/data
WORKDIR /app
# pnpm-workspace.yaml marks the root for the env loader (no .env is shipped).
COPY --from=build /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
