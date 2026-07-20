import { getTranslations } from 'next-intl/server'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { GlassCard } from '@/components/ui/GlassCard'
import { requireUser } from '@/lib/auth/require-user'
import { DangerZone } from './DangerZone'
import { getProfile } from './data'
import { ProfileForm } from './ProfileForm'

/** Profile tab (P5-01): currency preferences + reused language/theme switchers. */
export default async function ProfilePage() {
  const claims = await requireUser()
  const t = await getTranslations('settings.profile')
  const profile = await getProfile()
  const email = typeof claims.email === 'string' ? claims.email : ''

  return (
    <div className="flex flex-col gap-6">
      <GlassCard className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-medium text-ink text-sm">{t('account')}</h2>
          {email ? (
            <p className="text-ink-soft text-sm">
              {t('signedInAs', { email })}
            </p>
          ) : null}
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col gap-4">
        <h2 className="font-medium text-ink text-sm">{t('currencies')}</h2>
        <ProfileForm
          baseCurrency={profile.base_currency}
          displayCurrency={profile.display_currency}
        />
      </GlassCard>

      <GlassCard className="flex flex-col gap-4">
        <h2 className="font-medium text-ink text-sm">{t('preferences')}</h2>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-ink-soft text-sm">{t('language')}</span>
            <LocaleSwitcher />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-ink-soft text-sm">{t('theme')}</span>
            <ThemeSwitcher />
          </div>
        </div>
      </GlassCard>

      {email ? <DangerZone email={email} /> : null}
    </div>
  )
}
