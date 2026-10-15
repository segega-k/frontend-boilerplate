# syntax=docker/dockerfile:1.7
# Build context: the workspace root (spikes/site). `docker build -f apps/site/Dockerfile .`
# One image per environment: NEXT_PUBLIC_* values and the build-time Server Actions key are baked in.
ARG NODE_IMAGE=node:24-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/site/package.json apps/site/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @spike/site...

FROM deps AS build
COPY packages/ui packages/ui
COPY apps/site apps/site
ARG DEPLOYMENT_ID=dev
ENV NEXT_TELEMETRY_DISABLED=1 DEPLOYMENT_ID=${DEPLOYMENT_ID}
# Optional fixed key for multi-instance deploys (BuildKit secret, never a build arg):
# docker build --secret id=actions_key,env=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ...
RUN --mount=type=secret,id=actions_key,required=false \
    if [ -f /run/secrets/actions_key ]; then export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/actions_key)"; fi; \
    cd apps/site && pnpm exec next build && node scripts/copy-static.mjs

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /repo/apps/site/.next/standalone ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:3000/en').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/site/server.js"]
