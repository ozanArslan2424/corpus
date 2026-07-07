FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# STEP 1: BUILD
FROM base AS build
COPY . .
ENV CI=true
# install all deps, Bun handles the workspace natively
RUN bun install
# order of build matters
RUN bun run --filter @ozanarslan/corpus build
RUN bun run --filter corpus-docs build

# STEP 2: RELEASE
FROM base AS release
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/packages/docs/dist .
EXPOSE 3000
ENV NODE_ENV=production
CMD ["bun", "run", "index.js"]
