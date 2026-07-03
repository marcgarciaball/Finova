import { Tags } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

/**
 * Donut replacement for the "everything is uncategorized" case — a single-color
 * donut says nothing, so prompt the user to categorize instead.
 */
export function CategorizeEmptyState({
  title,
  body,
  cta,
}: {
  title: string
  body: string
  cta: string
}) {
  return (
    <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-glass-line border-dashed p-6 text-center">
      <Tags className="size-8 text-brand-300" aria-hidden="true" />
      <p className="font-medium text-ink text-sm">{title}</p>
      <p className="max-w-xs text-ink-soft text-xs">{body}</p>
      <Button asChild size="sm">
        <Link href="/protected/transactions">{cta}</Link>
      </Button>
    </div>
  )
}
