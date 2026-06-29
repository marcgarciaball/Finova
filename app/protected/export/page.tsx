import { Download, FileJson, FileSpreadsheet } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { requireUser } from '@/lib/auth/require-user'

/**
 * Export surface (P4-05). Two downloads: the transactions CSV ledger (re-imports
 * cleanly) and the full JSON bundle. The actual files stream from the sibling
 * route handlers, RLS-scoped.
 */
export default async function ExportPage() {
  await requireUser()
  const t = await getTranslations('export')

  const cards = [
    {
      key: 'csv',
      href: '/protected/export/transactions.csv',
      Icon: FileSpreadsheet,
    },
    {
      key: 'json',
      href: '/protected/export/data.json',
      Icon: FileJson,
    },
  ] as const

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-2xl">{t('title')}</h1>
        <p className="max-w-2xl text-ink-soft text-sm">{t('description')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map(({ key, href, Icon }) => (
          <GlassCard key={key} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <span className="font-medium text-ink">
                  {t(`${key}.title`)}
                </span>
                <span className="text-ink-soft text-xs">
                  {t(`${key}.description`)}
                </span>
              </div>
            </div>
            <Button asChild variant="outline" className="w-fit">
              {/* Plain anchor + download: lets the browser stream the file. */}
              <a href={href} download>
                <Download aria-hidden="true" />
                {t(`${key}.download`)}
              </a>
            </Button>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
