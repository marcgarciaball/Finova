'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { DataTab } from './data-tab'

/**
 * Tab switcher for the merged Import/Export "Datos" screen (nav IA priority
 * 2). URL-driven (`?tab=`) so each tab is a shareable, server-rendered view —
 * same pattern as `PeriodSelector`.
 */
export function DataTabs({
  value,
  ariaLabel,
  importLabel,
  exportLabel,
}: {
  value: DataTab
  ariaLabel: string
  importLabel: string
  exportLabel: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const options = [
    { value: 'import', label: importLabel },
    { value: 'export', label: exportLabel },
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
