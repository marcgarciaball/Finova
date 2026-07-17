'use client'

import { useState } from 'react'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { CATEGORY_COLORS, ICON_NAMES } from '@/lib/domain/categories/icons'
import { cn } from '@/lib/utils'

/**
 * Icon + color picker for a category (P5-01). Selection is mirrored into hidden
 * inputs (`iconName` / `color`) so it submits with the enclosing form; both are
 * allowlist-bound (`ICON_NAMES` / `CATEGORY_COLORS`).
 */
export function IconColorPicker({
  defaultIconName,
  defaultColor,
  labels,
}: {
  defaultIconName?: string | null
  defaultColor?: string | null
  labels: { icon: string; color: string }
}) {
  const [icon, setIcon] = useState<string>(defaultIconName ?? ICON_NAMES[0])
  const [color, setColor] = useState<string>(defaultColor ?? CATEGORY_COLORS[0])

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="iconName" value={icon} />
      <input type="hidden" name="color" value={color} />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-ink-soft text-xs">{labels.icon}</legend>
        <div className="flex flex-wrap gap-2">
          {ICON_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              aria-pressed={icon === name}
              onClick={() => setIcon(name)}
              className={cn(
                'rounded-full ring-2 ring-transparent transition',
                icon === name && 'ring-brand-500'
              )}
            >
              <CategoryIcon iconName={name} color={color} />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-ink-soft text-xs">{labels.color}</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={cn(
                'size-7 rounded-full ring-2 ring-transparent transition',
                color === c && 'ring-ink'
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </fieldset>
    </div>
  )
}
