import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { GlassCard } from '@/components/ui/GlassCard'

const LAST_UPDATED = '2026-07-20'

/** Public privacy policy (P5-07). Draft template — needs legal review. */
export default async function PrivacyPage() {
  const t = await getTranslations('legal')
  const p = await getTranslations('legal.privacy')
  const company = t('companyPlaceholder')

  const sections = [
    { heading: p('dataHeading'), body: p('dataBody') },
    { heading: p('controllerHeading'), body: p('controllerBody', { company }) },
    { heading: p('legalBasisHeading'), body: p('legalBasisBody') },
    { heading: p('subprocessorsHeading'), body: p('subprocessorsBody') },
    { heading: p('rightsHeading'), body: p('rightsBody') },
    { heading: p('retentionHeading'), body: p('retentionBody') },
    { heading: p('cookiesHeading'), body: p('cookiesBody') },
    { heading: p('securityHeading'), body: p('securityBody') },
    { heading: p('transfersHeading'), body: p('transfersBody') },
    { heading: p('childrenHeading'), body: p('childrenBody') },
    { heading: p('contactHeading'), body: p('contactBody') },
  ]

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href="/" className="text-ink-soft text-sm hover:text-ink">
          ← {t('footerPrivacy')}
        </Link>
        <h1 className="font-bold text-2xl text-ink">{p('title')}</h1>
        <p className="text-ink-soft text-xs">
          {t('lastUpdatedLabel')}: {LAST_UPDATED}
        </p>
      </div>

      <GlassCard className="border-cat-amber/40">
        <p className="text-ink-soft text-sm">{t('draftNotice')}</p>
      </GlassCard>

      <p className="text-ink text-sm">{p('intro')}</p>

      {sections.map((s) => (
        <section key={s.heading} className="flex flex-col gap-1.5">
          <h2 className="font-medium text-ink text-lg">{s.heading}</h2>
          <p className="text-ink-soft text-sm leading-relaxed">{s.body}</p>
        </section>
      ))}
    </main>
  )
}
