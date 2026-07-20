'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  EXPORT_VIEWS,
  type ExportView,
} from '@/app/protected/export/export-view'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

/**
 * Domain selector shared by the Import and Export tabs (Spec A/B). URL-driven
 * (`?domain=`) so each view is a shareable, server-rendered surface — same
 * pattern as `DataTabs`. The four domains are the same in both directions; the
 * `?tab=` param is preserved.
 */
export function DomainTabs({
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
