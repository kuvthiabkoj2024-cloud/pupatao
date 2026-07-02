import type { Config } from "@react-router/dev/config"
import { vercelPreset } from "@vercel/react-router/vite"

export default {
  ssr: true,
  // Apply the Vercel preset only on Vercel (VERCEL=1 is set during their build).
  // Locally it's omitted so `react-router build` emits the standard
  // build/server/index.js that `react-router-serve` (bun run start) can run —
  // needed to test the production build + service worker over ngrok.
  presets: process.env.VERCEL ? [vercelPreset()] : [],
} satisfies Config
