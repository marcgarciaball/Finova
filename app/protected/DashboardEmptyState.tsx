import { ArrowRight, Upload, Wallet } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'

/**
 * Dashboard empty state (P4-06). Shown when the user has no accounts (or no
 * transactions yet) — points them at the two first actions, in both languages.
 */
export async function DashboardEmptyState() {
  const t = await getTranslations('dashboard.empty')

  return (
    <GlassCard className="flex flex-col items-start gap-4 text-center sm:items-center">
      <div className="flex flex-col gap-2 sm:items-center">
        <h2 className="font-display font-semibold text-ink text-xl">
          {t('title')}
        </h2>
        <p className="max-w-md text-ink-soft text-sm">{t('body')}</p>
      </div>
      <div className="flex flex-wrap gap-3 sm:justify-center">
        <Button asChild>
          <Link href="/protected/accounts">
            <Wallet aria-hidden="true" />
            {t('addAccount')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/protected/import">
            <Upload aria-hidden="true" />
            {t('import')}
          </Link>
        </Button>
      </div>
    </GlassCard>
  )
}
