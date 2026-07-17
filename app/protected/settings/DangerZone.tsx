'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { emailConfirmationMatches } from '@/lib/validation/profile'
import { type ActionResult, deleteAccount } from './actions'

/**
 * Permanent-deletion "danger zone" (P5-02). The delete button unlocks only when
 * the typed email matches the signed-in address (the server re-checks). On
 * success the action redirects to /goodbye, so there is no success state here.
 */
export function DangerZone({ email }: { email: string }) {
  const t = useTranslations('settings.danger')
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(deleteAccount, undefined)
  const [confirmation, setConfirmation] = useState('')

  const matches = emailConfirmationMatches(confirmation, email)
  const err = state && !state.ok ? state.error : undefined

  return (
    <GlassCard className="flex flex-col gap-4 border-neg/40">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-neg text-sm">{t('title')}</h2>
        <p className="text-ink-soft text-sm">{t('warning')}</p>
      </div>

      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/protected/export">{t('downloadFirst')}</Link>
        </Button>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-confirm">{t('confirmLabel', { email })}</Label>
          <Input
            id="delete-confirm"
            name="confirmation"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
            placeholder={email}
            className="max-w-sm"
          />
        </div>

        {err ? <p className="text-neg text-sm">{t('error')}</p> : null}

        <div>
          <Button
            type="submit"
            variant="destructive"
            disabled={!matches || pending}
          >
            {t('deleteButton')}
          </Button>
        </div>
      </form>
    </GlassCard>
  )
}
