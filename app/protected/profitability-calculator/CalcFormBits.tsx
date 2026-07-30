'use client'

import { Field, SELECT_CLASS } from '@/app/protected/debts/FormBits'
import { Input } from '@/components/ui/Input'

export { Field, SELECT_CLASS }

export function NumberField({
  id,
  label,
  value,
  onChange,
  min = 0,
  step = 'any',
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  step?: number | 'any'
}) {
  return (
    <Field id={id} label={label}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.valueAsNumber || 0)}
      />
    </Field>
  )
}
