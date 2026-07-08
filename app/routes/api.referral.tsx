import type { Route } from './+types/api.referral'
import { prisma } from '~/lib/prisma.server'
import { buildReferralShareUrl, generateUniqueReferralCode } from '~/lib/referral.server'

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
  const referrals = await prisma.user.findMany({
    where: { referredById: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, tel: true, firstName: true, lastName: true, createdAt: true, firstTopupApprovedAt: true },
  })

  return Response.json({
    code,
    shareUrl,
    referrals: referrals.map(r => ({
      id: r.id,
      tel: r.tel,
      name: [r.firstName, r.lastName].filter(Boolean).join(' ') || null,
      joinedAt: r.createdAt.toISOString(),
      bonusPaid: !!r.firstTopupApprovedAt,
    })),
  })
}
