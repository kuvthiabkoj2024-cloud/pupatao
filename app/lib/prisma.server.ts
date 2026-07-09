import { PrismaClient } from '@prisma/client'

// ── Connection-pool cap (critical for Vercel serverless) ─────────────────────
// Each serverless instance opens its OWN Mongo connection pool. With no cap,
// Prisma defaults to (num_cpus * 2 + 1) connections per instance, and Vercel
// spins up many instances under load — so total connections explode past the
// Atlas limit (we saw 198%+ of the configured limit). When Atlas hits the cap
// it CLEARS pools, which surfaces as the "connection pool cleared …
// RetryableWriteError" crash on every query.
//
// Fix: force a small pool per instance and reap idle connections quickly so
// scaled-down instances release them. Applied here in code (not just the env
// var) so the cap ships with the deploy and can't be forgotten. Any params
// already present in DATABASE_URL win.
function buildDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    const setIfAbsent = (k: string, v: string) => {
      if (!url.searchParams.has(k)) url.searchParams.set(k, v)
    }
    // Small pool per instance — serverless handles low concurrency each, but
    // there are MANY instances, so the product is what matters.
    setIfAbsent('maxPoolSize', '3')
    // Release idle connections fast so idle/scaled-down instances free their slots.
    setIfAbsent('maxIdleTimeMS', '10000')
    // Fail fast instead of piling up waiters when the pool is momentarily full.
    setIfAbsent('waitQueueTimeoutMS', '5000')
    return url.toString()
  } catch {
    // If DATABASE_URL isn't a parseable URL for some reason, use it as-is.
    return raw
  }
}

// Single Prisma instance per process. Prevents "too many connections" during
// dev HMR (Vite re-evaluates modules on change, which would re-instantiate).
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient }

export const prisma = globalForPrisma.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
  datasourceUrl: buildDatabaseUrl(),
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma
}
