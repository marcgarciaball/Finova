'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { AccountForm } from './AccountForm'

/** "New account" toggle that reveals the create form (page is a server comp). */
export function CreateAccountPanel({ baseCurrency }: { baseCurrency: string }) {
  const t = useTranslations('accounts')
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        {t('new')}
      </Button>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <AccountForm
          baseCurrency={baseCurrency}
          onDone={() => setOpen(false)}
        />
      </CardContent>
    </Card>
  )
}
