'use client'

import type { ReactNode } from 'react'
import { Label } from '@/components/ui/Label'

export const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

/** Label + control + inline error, the shared field layout of every form. */
export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-neg text-xs">{error}</p> : null}
    </div>
  )
}
