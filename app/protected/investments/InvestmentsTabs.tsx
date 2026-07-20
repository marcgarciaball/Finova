'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { InvestmentsTab } from './investments-tab'

/** URL-driven (`?tab=`) tab switcher — DataTabs/SettingsTabs pattern. */
export function InvestmentsTabs({
  value,
  ariaLabel,
  overviewLabel,
  incomeLabel,
  transactionsLabel,
}: {
  value: InvestmentsTab
  ariaLabel: string
  overviewLabel: string
  incomeLabel: string
  transactionsLabel: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const options = [
    { value: 'overview', label: overviewLabel },
    { value: 'income', label: incomeLabel },
    { value: 'transactions', label: transactionsLabel },
  ]

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <SegmentedControl
      aria-label={ariaLabel}
      options={options}
      value={value}
      onValueChange={onChange}
    />
  )
}
