'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/protected/settings', key: 'profile' },
  { href: '/protected/settings/categories', key: 'categories' },
  { href: '/protected/settings/rules', key: 'rules' },
] as const

/** Top tab bar for the Settings surface (P5-01). Active tab from the pathname. */
export function SettingsTabs() {
  const t = useTranslations('settings.tabs')
  const pathname = usePathname()

  return (
    <nav
      aria-label={t('label')}
      className="flex gap-1 border-glass-line border-b"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === '/protected/settings'
            ? pathname === tab.href
            : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 font-medium text-sm transition-colors',
              active
                ? 'border-brand-500 text-ink'
                : 'border-transparent text-ink-soft hover:text-ink'
            )}
          >
            {t(tab.key)}
          </Link>
        )
      })}
    </nav>
  )
}
