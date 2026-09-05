FROM oven/bun:1 AS base
WORKDIR /usr/src/app

FROM base AS build
COPY . .
RUN bun add -g pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm --filter corpus-docs build
RUN find . -not -path '*/node_modules/*' -not -path '*/.git/*'

FROM base AS release
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/packages/docs/dist ./dist
EXPOSE 3000
ENV NODE_ENV=production
RUN find . -not -path '*/node_modules/*' -not -path '*/.git/*'
CMD ["bun", "run", "dist/index.js"]
