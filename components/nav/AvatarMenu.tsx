'use client'

import {
  Database,
  Languages,
  Laptop,
  LogOut,
  Moon,
  Settings,
  Sun,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useMounted } from '@/lib/hooks/useMounted'
import { setLocale } from '@/lib/i18n/actions'
import { type Locale, locales } from '@/lib/i18n/config'
import { createClient } from '@/lib/supabase/client'

/**
 * Avatar/overflow menu for the app shell (nav IA priority 2): Datos, Settings,
 * language and theme (as submenus), and logout — all in one place instead of
 * five separate top-bar controls.
 */
export function AvatarMenu({ email }: { email: string }) {
  const t = useTranslations()
  const router = useRouter()
  const activeLocale = useLocale()
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const [, startLocaleTransition] = useTransition()

  function onLocaleChange(value: string) {
    const next = value as Locale
    if (next === activeLocale) return
    startLocaleTransition(async () => {
      await setLocale(next)
      router.refresh()
    })
  }

  async function onLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const initial = email.charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('nav.menu')}
          className="rounded-full"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-brand font-medium text-sm text-white">
            {initial}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/protected/data">
            <Database className="size-4" aria-hidden="true" />
            {t('nav.data')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/protected/settings">
            <Settings className="size-4" aria-hidden="true" />
            {t('nav.settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages className="size-4" aria-hidden="true" />
            {t('common.language')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={activeLocale}
              onValueChange={onLocaleChange}
            >
              {locales.map((locale) => (
                <DropdownMenuRadioItem key={locale} value={locale}>
                  {t(`locale.${locale}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {mounted ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {theme === 'dark' ? (
                <Moon className="size-4" aria-hidden="true" />
              ) : theme === 'light' ? (
                <Sun className="size-4" aria-hidden="true" />
              ) : (
                <Laptop className="size-4" aria-hidden="true" />
              )}
              {t('common.theme')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={theme ?? 'system'}
                onValueChange={setTheme}
              >
                <DropdownMenuRadioItem value="light" className="gap-2">
                  <Sun className="size-4" aria-hidden="true" />
                  {t('theme.light')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" className="gap-2">
                  <Moon className="size-4" aria-hidden="true" />
                  {t('theme.dark')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system" className="gap-2">
                  <Laptop className="size-4" aria-hidden="true" />
                  {t('theme.system')}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout}>
          <LogOut className="size-4" aria-hidden="true" />
          {t('common.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
