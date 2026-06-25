'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { DateFormat } from '@/lib/domain/import/mapping'
import type {
  AmountKind,
  CurrencyMode,
  DecimalChoice,
  MappingFormState,
} from '@/lib/domain/import/mapping-form'

const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

/** A `<select>` of the file's headers for one target field. */
function HeaderSelect({
  id,
  headers,
  value,
  onChange,
  allowNone,
  noneLabel,
}: {
  id: string
  headers: string[]
  value: string
  onChange: (v: string) => void
  allowNone?: boolean
  noneLabel?: string
}) {
  return (
    <select
      id={id}
      className={SELECT_CLASS}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowNone ? <option value="">{noneLabel}</option> : <option value="" />}
      {headers.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  )
}

/**
 * Controlled column-mapping editor (P2-03). Holds no state itself: the parent
 * owns {@link MappingFormState} so the live preview re-runs on every change.
 */
export function ColumnMappingForm({
  headers,
  state,
  onChange,
}: {
  headers: string[]
  state: MappingFormState
  onChange: (next: MappingFormState) => void
}) {
  const t = useTranslations('import')
  const set = (patch: Partial<MappingFormState>) =>
    onChange({ ...state, ...patch })

  return (
    <div className="flex flex-col gap-4">
      {/* Date */}
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="map-date">{t('fields.date')}</Label>
          <HeaderSelect
            id="map-date"
            headers={headers}
            value={state.dateColumn}
            onChange={(v) => set({ dateColumn: v })}
          />
        </div>
        <div className="flex w-36 flex-col gap-1.5">
          <Label htmlFor="map-date-format">{t('fields.dateFormat')}</Label>
          <select
            id="map-date-format"
            className={SELECT_CLASS}
            value={state.dateFormat}
            onChange={(e) => set({ dateFormat: e.target.value as DateFormat })}
          >
            {(['auto', 'dmy', 'mdy', 'ymd'] as const).map((f) => (
              <option key={f} value={f}>
                {t(`dateFormats.${f}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Amount mode */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="map-amount-kind">{t('fields.amountMode')}</Label>
        <select
          id="map-amount-kind"
          className={SELECT_CLASS}
          value={state.amountKind}
          onChange={(e) => set({ amountKind: e.target.value as AmountKind })}
        >
          <option value="single">{t('amountModes.single')}</option>
          <option value="debitCredit">{t('amountModes.debitCredit')}</option>
        </select>
      </div>

      {state.amountKind === 'single' ? (
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="map-amount">{t('fields.amount')}</Label>
            <HeaderSelect
              id="map-amount"
              headers={headers}
              value={state.singleColumn}
              onChange={(v) => set({ singleColumn: v })}
            />
          </div>
          <div className="flex w-44 flex-col gap-1.5">
            <Label htmlFor="map-negative">{t('fields.negativeIs')}</Label>
            <select
              id="map-negative"
              className={SELECT_CLASS}
              value={state.negativeIs}
              onChange={(e) =>
                set({ negativeIs: e.target.value as 'expense' | 'income' })
              }
            >
              <option value="expense">{t('negativeIs.expense')}</option>
              <option value="income">{t('negativeIs.income')}</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="map-debit">{t('fields.debit')}</Label>
            <HeaderSelect
              id="map-debit"
              headers={headers}
              value={state.debitColumn}
              onChange={(v) => set({ debitColumn: v })}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="map-credit">{t('fields.credit')}</Label>
            <HeaderSelect
              id="map-credit"
              headers={headers}
              value={state.creditColumn}
              onChange={(v) => set({ creditColumn: v })}
            />
          </div>
        </div>
      )}

      {/* Decimal separator */}
      <div className="flex w-44 flex-col gap-1.5">
        <Label htmlFor="map-decimal">{t('fields.decimal')}</Label>
        <select
          id="map-decimal"
          className={SELECT_CLASS}
          value={state.decimal}
          onChange={(e) => set({ decimal: e.target.value as DecimalChoice })}
        >
          <option value="">{t('decimals.auto')}</option>
          <option value=",">{t('decimals.comma')}</option>
          <option value=".">{t('decimals.dot')}</option>
        </select>
      </div>

      {/* Description + note */}
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="map-description">{t('fields.description')}</Label>
          <HeaderSelect
            id="map-description"
            headers={headers}
            value={state.descriptionColumn}
            onChange={(v) => set({ descriptionColumn: v })}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="map-note">{t('fields.note')}</Label>
          <HeaderSelect
            id="map-note"
            headers={headers}
            value={state.noteColumn}
            onChange={(v) => set({ noteColumn: v })}
            allowNone
            noneLabel={t('none')}
          />
        </div>
      </div>

      {/* Currency */}
      <div className="flex gap-3">
        <div className="flex w-44 flex-col gap-1.5">
          <Label htmlFor="map-currency-mode">{t('fields.currency')}</Label>
          <select
            id="map-currency-mode"
            className={SELECT_CLASS}
            value={state.currencyMode}
            onChange={(e) =>
              set({ currencyMode: e.target.value as CurrencyMode })
            }
          >
            <option value="none">{t('currencyModes.none')}</option>
            <option value="column">{t('currencyModes.column')}</option>
            <option value="fixed">{t('currencyModes.fixed')}</option>
          </select>
        </div>
        {state.currencyMode === 'column' ? (
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="map-currency-column">
              {t('fields.currencyColumn')}
            </Label>
            <HeaderSelect
              id="map-currency-column"
              headers={headers}
              value={state.currencyColumn}
              onChange={(v) => set({ currencyColumn: v })}
            />
          </div>
        ) : null}
        {state.currencyMode === 'fixed' ? (
          <div className="flex w-28 flex-col gap-1.5">
            <Label htmlFor="map-currency-fixed">
              {t('fields.currencyCode')}
            </Label>
            <Input
              id="map-currency-fixed"
              value={state.currencyFixed}
              onChange={(e) => set({ currencyFixed: e.target.value })}
              maxLength={3}
              className="uppercase"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
