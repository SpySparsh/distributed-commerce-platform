FROM node:24-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json tsconfig.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/cache/package.json packages/cache/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/events/package.json packages/events/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/queue/package.json packages/queue/package.json
COPY packages/search/package.json packages/search/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/worker apps/worker
COPY packages packages
RUN pnpm --filter @ecommerce/worker typecheck

FROM deps AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/worker apps/worker
COPY --from=build /app/packages packages
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "process.exit(0)"
CMD ["pnpm", "--filter", "@ecommerce/worker", "start"]
