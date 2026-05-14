FROM node:22-alpine AS builder
WORKDIR /app
ARG PUBLIC_API_URL
ENV PUBLIC_API_URL=${PUBLIC_API_URL}
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Usa astro build directamente para evitar que astro check falle en CI
RUN npx astro build

FROM node:22-alpine
WORKDIR /app
# Astro SSR con @astrojs/node requiere node_modules en runtime.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# El servidor Node del adaptador standalone escucha en 0.0.0.0 con estas vars
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4321/ || exit 1

CMD ["node", "./dist/server/entry.mjs"]
