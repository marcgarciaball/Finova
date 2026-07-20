import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { GlassCard } from '@/components/ui/GlassCard'

const LAST_UPDATED = '2026-07-20'

/** Public terms of service (P5-07). Draft template — needs legal review. */
export default async function TermsPage() {
  const t = await getTranslations('legal')
  const tt = await getTranslations('legal.terms')
  const company = t('companyPlaceholder')

  const sections = [
    { heading: tt('eligibilityHeading'), body: tt('eligibilityBody') },
    { heading: tt('useHeading'), body: tt('useBody') },
    { heading: tt('noAdviceHeading'), body: tt('noAdviceBody') },
    { heading: tt('ipHeading'), body: tt('ipBody', { company }) },
    { heading: tt('liabilityHeading'), body: tt('liabilityBody') },
    { heading: tt('terminationHeading'), body: tt('terminationBody') },
    { heading: tt('governingLawHeading'), body: tt('governingLawBody') },
    { heading: tt('changesHeading'), body: tt('changesBody') },
  ]

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href="/" className="text-ink-soft text-sm hover:text-ink">
          ← {t('footerTerms')}
        </Link>
        <h1 className="font-bold text-2xl text-ink">{tt('title')}</h1>
        <p className="text-ink-soft text-xs">
          {t('lastUpdatedLabel')}: {LAST_UPDATED}
        </p>
      </div>

      <GlassCard className="border-cat-amber/40">
        <p className="text-ink-soft text-sm">{t('draftNotice')}</p>
      </GlassCard>

      <p className="text-ink text-sm">{tt('intro')}</p>

      {sections.map((s) => (
        <section key={s.heading} className="flex flex-col gap-1.5">
          <h2 className="font-medium text-ink text-lg">{s.heading}</h2>
          <p className="text-ink-soft text-sm leading-relaxed">{s.body}</p>
        </section>
      ))}
    </main>
  )
}
