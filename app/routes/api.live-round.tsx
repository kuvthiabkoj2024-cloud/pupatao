import { prisma } from '~/lib/prisma.server'

// Lightweight current-live-round probe. Polled by the client while in live mode
// as a fallback for iOS Safari, which throttles the Pusher WebSocket while the
// live video is decoding — so `round:started` can arrive late and the betting
// board never appears. One indexed query; returns just what livePhase needs.
export async function loader() {
  const round = await prisma.gameRound.findFirst({
    where: { mode: 'LIVE', status: { in: ['BETTING', 'LOCKED', 'AWAITING_RESULT'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, bettingClosesAt: true, dice1: true, dice2: true, dice3: true },
  })
  return Response.json({
    round: round
      ? {
          id: round.id,
          status: round.status,
          bettingClosesAt: round.bettingClosesAt?.toISOString() ?? null,
          dice: [round.dice1, round.dice2, round.dice3] as (string | null)[],
        }
      : null,
  })
}
