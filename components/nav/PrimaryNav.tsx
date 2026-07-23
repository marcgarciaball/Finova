'use client'

import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/utils'

export interface PrimaryNavLink {
  href: string
  label: string
}

export type PrimaryNavEntry =
  | ({ type: 'link' } & PrimaryNavLink)
  | { type: 'group'; label: string; children: PrimaryNavLink[] }

export function PrimaryNav({ entries }: { entries: PrimaryNavEntry[] }) {
  const pathname = usePathname()

  return (
    <>
      {entries.map((entry) => {
        if (entry.type === 'link') {
          const active = pathname === entry.href
          return (
            <Link
              key={entry.href}
              href={entry.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'text-sm hover:text-ink',
                active ? 'font-semibold text-ink' : 'text-ink-soft'
              )}
            >
              {entry.label}
            </Link>
          )
        }

        const active = entry.children.some((child) => pathname === child.href)
        return (
          <DropdownMenu key={entry.label}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-active={active || undefined}
                className={cn(
                  'flex items-center gap-1 text-sm outline-none hover:text-ink',
                  active ? 'font-semibold text-ink' : 'text-ink-soft'
                )}
              >
                {entry.label}
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {entry.children.map((child) => {
                const childActive = pathname === child.href
                return (
                  <DropdownMenuItem key={child.href} asChild>
                    <Link
                      href={child.href}
                      aria-current={childActive ? 'page' : undefined}
                      className={cn(childActive && 'font-semibold text-ink')}
                    >
                      {child.label}
                    </Link>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
    </>
  )
}
