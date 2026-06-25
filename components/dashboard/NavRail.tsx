import Link from 'next/link'
import type * as React from 'react'
import { cn } from '@/lib/utils'

export interface NavItem {
  active?: boolean
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

export interface NavRailProps {
  className?: string
  items: NavItem[]
}

export function NavRail({ items, className }: NavRailProps) {
  return (
    <nav
      aria-label="Main"
      className={cn(
        'glass flex gap-1 rounded-4xl p-2',
        'flex-row md:flex-col',
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            title={item.label}
            aria-current={item.active ? 'page' : undefined}
            className={cn(
              'flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 items-center justify-center motion-safe:transition rounded-2xl size-11 transition-colors',
              item.active
                ? 'bg-brand text-white'
                : 'text-ink-soft hover:bg-brand-50 hover:text-ink'
            )}
          >
            <Icon className="size-5" />
            <span className="sr-only">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
