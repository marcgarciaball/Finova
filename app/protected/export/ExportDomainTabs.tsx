'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { ExportView } from './export-view'
import { EXPORT_VIEWS } from './export-view'

/**
 * Domain selector for the Export tab (Spec A). URL-driven (`?domain=`) so each
 * view is a shareable, server-rendered surface — same pattern as `DataTabs`.
 * Preserves the sibling `?tab=export` param.
 */
export function ExportDomainTabs({
  value,
  ariaLabel,
  labels,
}: {
  value: ExportView
  ariaLabel: string
  labels: Record<ExportView, string>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const options = EXPORT_VIEWS.map((v) => ({ value: v, label: labels[v] }))

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams)
    params.set('domain', next)
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
