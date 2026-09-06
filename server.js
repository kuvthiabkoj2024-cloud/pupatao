// ─── TEMPORARY diagnostic server ───────────────────────────────────────────
// This is @react-router/serve's own bin.js/cli.js logic, copied nearly
// verbatim (see node_modules/@react-router/serve/dist/cli.js), with ONE
// added middleware that logs the exact Origin/Host/X-Forwarded-* headers on
// every POST. Purpose: React Router's built-in CSRF guard is rejecting POST
// actions from an installed/standalone PWA on mobile with a generic "Bad
// Request" — the real Origin/Host values it's comparing are sanitized out of
// both the client response and the normal morgan access log line, so there's
// no way to see what's actually being sent without this.
//
// DELETE this file and revert the Dockerfile CMD back to
// `["npm", "run", "start"]` once the real header values are captured and the
// permanent fix (an addition to `allowedActionOrigins` in
// react-router.config.ts) is confirmed working.
import path from 'node:path'
import url from 'node:url'
import express from 'express'
import compression from 'compression'
import morgan from 'morgan'
import { createRequestHandler } from '@react-router/express'

const buildPath = path.resolve('./build/server/index.js')
const build = await import(url.pathToFileURL(buildPath).href)

const app = express()
app.disable('x-powered-by')
app.use(compression())
app.use(
  path.posix.join(build.publicPath ?? '/', 'assets'),
  express.static(path.join(build.assetsBuildDirectory, 'assets'), {
    immutable: true,
    maxAge: '1y',
  }),
)
app.use(build.publicPath ?? '/', express.static(build.assetsBuildDirectory))
app.use(express.static('public', { maxAge: '1h' }))
app.use(morgan('tiny'))

app.use((req, _res, next) => {
  if (req.method === 'POST') {
    console.log('[csrf-debug]', JSON.stringify({
      url: req.originalUrl,
      origin: req.headers['origin'] ?? null,
      host: req.headers['host'] ?? null,
      xForwardedHost: req.headers['x-forwarded-host'] ?? null,
      xForwardedProto: req.headers['x-forwarded-proto'] ?? null,
      referer: req.headers['referer'] ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    }))
  }
  next()
})

app.all('*', createRequestHandler({ build, mode: process.env.NODE_ENV }))

const port = process.env.PORT ?? 3000
app.listen(port, () => {
  console.log(`[server] listening on :${port}`)
})
