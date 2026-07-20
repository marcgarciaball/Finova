'use client'
import { GRANULARITIES } from '@finova/domain/dashboard'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const options = GRANULARITIES.map((g) => ({ value: g, label: t(g) }))

  const onChange = (next: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('granularity', next)
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
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
