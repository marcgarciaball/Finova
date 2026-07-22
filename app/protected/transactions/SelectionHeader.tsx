'use client'

import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/Checkbox'
import { useSelection } from './SelectionContext'

export function SelectionHeader() {
  const t = useTranslations('transactions')
  const { headerState, toggleHeader } = useSelection()

  return (
    <div className="flex items-center gap-2 px-1">
      <Checkbox
        checked={headerState === 'indeterminate' ? 'indeterminate' : headerState === 'checked'}
        onCheckedChange={toggleHeader}
        aria-label={t('selection.selectPage')}
      />
      <span className="text-ink-soft text-xs">{t('selection.selectPage')}</span>
    </div>
  )
}
