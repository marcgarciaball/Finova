'use client'
import { GRANULARITIES } from '@finova/domain/dashboard'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

/**
 * URL-driven day/month/year toggle for the income-vs-expense chart. Same
 * pattern as `PeriodSelector`: the choice lives in `?granularity=`, so the
 * view is shareable + server-rendered.
 */
export function GranularitySelector({ value }: { value: string }) {
  const t = useTranslations('dashboard.granularity')
  const router = useRouter()
  const [, startTransition] = useTransition()

  const options = GRANULARITIES.map((g) => ({ value: g, label: t(g) }))

  const onChange = (next: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('granularity', next)
    startTransition(() => {
      router.push(`${url.pathname}?${url.searchParams.toString()}`)
    })
  }

  return (
    <SegmentedControl
      aria-label={t('label')}
      options={options}
      value={value}
      onValueChange={onChange}
    />
  )
}
