import { getTranslations } from 'next-intl/server'
import { listAccounts } from '@/app/protected/accounts/data'
import { requireUser } from '@/lib/auth/require-user'
import { ImportClient } from './ImportClient'

export default async function ImportPage() {
  await requireUser()
  const [t, accounts] = await Promise.all([
    getTranslations('import'),
    listAccounts(),
  ])

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-bold text-2xl">{t('title')}</h1>
        <p className="text-ink-soft text-sm">{t('subtitle')}</p>
      </div>
      <ImportClient accounts={accounts} />
    </div>
  )
}
