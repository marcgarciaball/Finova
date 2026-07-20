import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'

/**
 * Public confirmation shown after account deletion (P5-02). The user is signed
 * out by this point, so this route is allow-listed in the auth route guard.
 */
export default async function GoodbyePage() {
  const t = await getTranslations('goodbye')

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <GlassCard className="flex max-w-md flex-col gap-4 text-center">
        <h1 className="font-bold text-2xl text-ink">{t('title')}</h1>
        <p className="text-ink-soft text-sm">{t('body')}</p>
        <div className="flex justify-center">
          <Button asChild>
            <Link href="/">{t('home')}</Link>
          </Button>
        </div>
      </GlassCard>
    </main>
  )
}
