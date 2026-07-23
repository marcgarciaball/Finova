'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { useSelection } from './SelectionContext'

export function SelectionHeader() {
  const t = useTranslations('transactions')
  const { active, activate, deactivate, headerState, toggleHeader } =
    useSelection()

  if (!active) {
    return (
      <div className="flex justify-end px-1">
        <Button type="button" variant="outline" size="sm" onClick={activate}>
          {t('selection.enable')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={
            headerState === 'indeterminate'
              ? 'indeterminate'
              : headerState === 'checked'
          }
          onCheckedChange={toggleHeader}
          aria-label={t('selection.selectPage')}
        />
        <span className="text-ink-soft text-xs">
          {t('selection.selectPage')}
        </span>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={deactivate}>
        {t('cancel')}
      </Button>
    </div>
  )
}
