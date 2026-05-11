# backend/Dockerfile — Multi-stage build for minimal image size
FROM oven/bun:alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .

FROM oven/bun:alpine
WORKDIR /app
COPY --from=builder /app .

# Create uploads directory
RUN mkdir -p /app/public/uploads

EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
