import type { Route } from './+types/api.referral'
import { prisma } from '~/lib/prisma.server'
import { buildReferralShareUrl, generateUniqueReferralCode } from '~/lib/referral.server'
import { getReferralConfig } from '~/lib/system-settings.server'

// Referral data for the current user (code, share URL, invited list). Loaded
// on demand when the referral modal opens (e.g. from the live screen button),
// so the home loader stays light.
export async function loader({ request }: Route.LoaderArgs) {
  const { getCurrentUser } = await import('~/lib/auth.server')
  const user = await getCurrentUser(request)
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  let code = user.referralCode
  if (!code) {
    code = await generateUniqueReferralCode()
    await prisma.user.update({ where: { id: user.id }, data: { referralCode: code } }).catch(() => { /* best effort */ })
  }
  const shareUrl = buildReferralShareUrl(request, code)
  const [referrals, commissionAgg, campaign] = await Promise.all([
    prisma.user.findMany({
      where: { referredById: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, tel: true, firstName: true, lastName: true, createdAt: true },
    }),
    // Per-referee lifetime commission this user has earned from them — the
    // campaign pays on EVERY approved deposit, not just the first, so a
    // single paid/pending badge no longer tells the whole story.
    prisma.transaction.groupBy({
      by: ['targetUserId'],
      where: { type: 'REFERRAL_BONUS', userId: user.id },
      _sum: { amount: true },
    }),
    getReferralConfig(),
  ])
  const earnedByReferee = new Map(commissionAgg.map(c => [c.targetUserId, c._sum.amount ?? 0]))

  return Response.json({
    code,
    shareUrl,
    campaign: { enabled: campaign.enabled, percent: campaign.percent },
    referrals: referrals.map(r => ({
      id: r.id,
      tel: r.tel,
      name: [r.firstName, r.lastName].filter(Boolean).join(' ') || null,
      joinedAt: r.createdAt.toISOString(),
      totalEarned: earnedByReferee.get(r.id) ?? 0,
    })),
  })
}
