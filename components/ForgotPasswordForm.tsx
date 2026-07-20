'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const t = useTranslations('auth')

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      })
      if (error) throw error
      setSuccess(true)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : t('genericError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      {success ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {t('forgot.successTitle')}
            </CardTitle>
            <CardDescription>{t('forgot.successDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              {t('forgot.successBody')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t('forgot.title')}</CardTitle>
            <CardDescription>{t('forgot.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">{t('fields.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t('forgot.submitting') : t('forgot.submit')}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                {t('forgot.haveAccount')}{' '}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4"
                >
                  {t('forgot.loginLink')}
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
