import type { Route } from './+types/api.cron.notifications'

// Vercel Cron hits this on a schedule (see vercel.json). It fires any campaign
// that is due — one-time sends whose time has passed, and daily sends at their
// configured GMT+7 time. Protected by CRON_SECRET (Vercel sends it as a Bearer
// token automatically when the env var is set).
export async function loader({ request }: Route.LoaderArgs) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })
  }

  const { runDueCampaigns } = await import('~/lib/notifications.server')
  const result = await runDueCampaigns(new Date())
  return Response.json({ ok: true, ...result })
}
