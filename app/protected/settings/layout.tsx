import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { requireUser } from '@/lib/auth/require-user'
import { SettingsTabs } from './SettingsTabs'

/** Shared shell for the Settings tabs (Profile · Categories · Rules) — P5-01. */
export default async function SettingsLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireUser()
  const t = await getTranslations('settings')

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <h1 className="font-bold text-2xl">{t('title')}</h1>
      <SettingsTabs />
      {children}
    </div>
  )
}
