FROM node:24-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/cache/package.json packages/cache/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/events/package.json packages/events/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/queue/package.json packages/queue/package.json
COPY packages/search/package.json packages/search/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/api apps/api
COPY packages packages
RUN pnpm --filter @ecommerce/api typecheck

FROM deps AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/api apps/api
COPY --from=build /app/packages packages
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health >/dev/null || exit 1
CMD ["pnpm", "--filter", "@ecommerce/api", "start"]
