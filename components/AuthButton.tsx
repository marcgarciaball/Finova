import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { LogoutButton } from '@/components/LogoutButton'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/server'

export async function AuthButton() {
  const supabase = await createClient()
  const t = await getTranslations('auth')

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims()

  const user = data?.claims

  return user ? (
    <div className="flex items-center gap-4">
      {t('greeting', { email: String(user.email ?? '') })}
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={'outline'}>
        <Link href="/auth/login">{t('signIn')}</Link>
      </Button>
      <Button asChild size="sm" variant={'default'}>
        <Link href="/auth/sign-up">{t('signUp')}</Link>
      </Button>
    </div>
  )
}
