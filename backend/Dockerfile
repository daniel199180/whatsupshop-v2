FROM oven/bun:alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
# --production skips devDependencies; no --frozen-lockfile so bun resolves
# platform binaries for the build OS (Linux) instead of the lockfile's macOS pins
RUN bun install --production
COPY src ./src

FROM oven/bun:alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY package.json ./

RUN mkdir -p /app/public/uploads

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["bun", "run", "src/index.ts"]
