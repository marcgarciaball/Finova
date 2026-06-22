import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/auth/require-user'

export default async function ProtectedPage() {
  const claims = await requireUser()
  const t = await getTranslations('protected')

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <h1 className="font-bold text-2xl">{t('title')}</h1>
      <p className="text-muted-foreground text-sm">
        {t('signedInAs', { email: String(claims.email ?? '') })}
      </p>
    </div>
  )
}
