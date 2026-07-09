# ─── Build stage ──────────────────────────────────────────────────────────
# Debian (glibc), NOT Alpine (musl). glibc images "just work" with native
# modules like lightningcss and Prisma — no special binary targets needed.
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Prisma's query engine needs OpenSSL present.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies INSIDE this image so every native binary (lightningcss,
# prisma) matches the container's platform. Never copy node_modules from the host.
#
# DO NOT copy the macOS package-lock.json: it pins the macOS native packages and
# makes npm skip the Linux binaries (lightningcss/rollup/esbuild) — the npm
# optionalDependencies bug (npm/cli#4828). Installing from package.json alone
# forces a fresh, Linux-correct resolve that pulls the right native binaries.
COPY package.json ./
RUN npm install --no-audit --no-fund

# Now bring in the source (host node_modules/.env excluded via .dockerignore)
COPY . .

RUN npx prisma generate
RUN npm run build

# ─── Runtime stage ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy only what's needed to run the server.
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/prisma ./prisma

EXPOSE 5176
# DATABASE_URL and other secrets are injected at runtime (docker run -e ...),
# NOT baked into the image.
CMD ["npm", "run", "start"]
