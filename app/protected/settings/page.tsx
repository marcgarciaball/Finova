import { getTranslations } from 'next-intl/server'
import { GlassCard } from '@/components/ui/GlassCard'
import { requireUser } from '@/lib/auth/require-user'

/** Settings placeholder, reachable from the avatar menu (nav IA priority 2). */
export default async function SettingsPage() {
  const claims = await requireUser()
  const t = await getTranslations('protected')
  const email = typeof claims.email === 'string' ? claims.email : ''

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <h1 className="font-bold text-2xl">{t('title')}</h1>
      <GlassCard className="flex flex-col gap-2">
        <p className="text-ink text-sm">{t('signedInAs', { email })}</p>
        <p className="text-ink-soft text-sm">{t('comingSoon')}</p>
      </GlassCard>
    </div>
  )
}
