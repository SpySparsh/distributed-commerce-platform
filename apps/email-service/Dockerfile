FROM node:24-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json tsconfig.json ./
COPY apps/email-service/package.json apps/email-service/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/logger/package.json packages/logger/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/email-service apps/email-service
COPY packages/config packages/config
COPY packages/logger packages/logger
RUN pnpm install --frozen-lockfile --offline
RUN pnpm --filter @ecommerce/email-service build

FROM build AS runner
ENV NODE_ENV=production
WORKDIR /app
USER node
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4100/health >/dev/null || exit 1
CMD ["node", "apps/email-service/dist/index.js"]
