import { cn } from '@/lib/utils'

export interface ListRowProps {
  amount: number
  categoryColor?: string
  className?: string
  format?: (n: number) => string
  income?: boolean
  subtitle?: string
  title: string
}

export function ListRow({
  title,
  subtitle,
  amount,
  income = false,
  categoryColor = 'var(--cat-blue)',
  format = (n) => n.toLocaleString(),
  className,
}: ListRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-glass-line border-b py-3 last:border-b-0',
        className
      )}
    >
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: categoryColor }}
      />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-ink text-sm">{title}</span>
        {subtitle && (
          <span className="truncate text-ink-soft text-xs">{subtitle}</span>
        )}
      </div>
      <span
        className={cn(
          'ml-auto font-medium text-sm tabular-nums',
          income ? 'text-pos' : 'text-ink'
        )}
      >
        {`${income ? '+' : ''}${format(amount)}`}
      </span>
    </div>
  )
}
