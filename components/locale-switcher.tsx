'use client'

import { Languages } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { setLocale } from '@/lib/i18n/actions'
import { type Locale, locales } from '@/lib/i18n/config'

const ICON_SIZE = 16

export function LocaleSwitcher() {
  const t = useTranslations()
  const activeLocale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function onSelect(value: string) {
    const next = value as Locale
    if (next === activeLocale) return
    startTransition(async () => {
      await setLocale(next)
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('common.language')}
          disabled={isPending}
        >
          <Languages size={ICON_SIZE} className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-content" align="end">
        <DropdownMenuRadioGroup value={activeLocale} onValueChange={onSelect}>
          {locales.map((locale) => (
            <DropdownMenuRadioItem key={locale} value={locale}>
              {t(`locale.${locale}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
