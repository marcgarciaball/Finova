import {
  Car,
  CircleDashed,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  type LucideIcon,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  UtensilsCrossed,
  Wallet,
  Zap,
} from 'lucide-react'
import { FALLBACK_ICON_NAME } from '@/lib/domain/categories/icons'
import { cn } from '@/lib/utils'

/**
 * Explicit name → component lookup (not a wildcard import from lucide-react)
 * so unused icons stay tree-shaken. Extend this alongside
 * `lib/domain/categories/icons.ts` whenever a new default icon is introduced.
 */
const ICONS: Record<string, LucideIcon> = {
  Home,
  Utensils,
  ShoppingCart,
  UtensilsCrossed,
  Car,
  Zap,
  HeartPulse,
  ShoppingBag,
  Gamepad2,
  GraduationCap,
  Plane,
  Wallet,
  Gift,
  CircleDashed,
}

/**
 * Colored category icon chip (P4): a tinted circular backdrop behind the
 * Lucide glyph, replacing the plain colored dot. Falls back to a dashed
 * circle for custom categories that have no `icon_name` yet (no picker
 * exists for those — see the icons.ts scope note) and for any unrecognized
 * name.
 */
export function CategoryIcon({
  iconName,
  color,
  className,
}: {
  iconName?: string | null
  color?: string | null
  className?: string
}) {
  const Icon =
    (iconName ? ICONS[iconName] : undefined) ??
    ICONS[FALLBACK_ICON_NAME] ??
    CircleDashed
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full',
        !color && 'bg-black/5 dark:bg-white/10',
        className
      )}
      style={
        color
          ? { backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)` }
          : undefined
      }
    >
      <Icon
        aria-hidden="true"
        className={cn('size-4', !color && 'text-ink-soft')}
        style={color ? { color } : undefined}
      />
    </span>
  )
}
