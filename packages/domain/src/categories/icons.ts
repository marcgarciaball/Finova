import { DEFAULT_CATEGORIES } from './defaults'

/**
 * Fixed icon + color map for default categories (P4 icons).
 *
 * Pure data — no React, no lucide-react import here, so this stays testable
 * and framework-free. `components/dashboard/CategoryIcon.tsx` resolves the
 * icon name string to an actual Lucide component. `color` is a `--cat-*`
 * CSS-var reference so it tracks the light/dark palette automatically.
 *
 * This is the single source of truth for the seeded icon/color pairs: it
 * drives both the DB seed (`seed_default_categories()` in migration `0010`)
 * and the UI fallback for any default category. Keep the two in sync.
 */
export interface CategoryIconEntry {
  color: string
  iconName: string
}

/** Icon shown for a category with no `icon_name` (custom, or unresolved). */
export const FALLBACK_ICON_NAME = 'CircleDashed'

/**
 * The icon names a user may pick in the category picker (P5-01). Must stay in
 * sync with the `ICONS` map in `components/dashboard/CategoryIcon.tsx` — every
 * name here has to resolve to a real Lucide component there. Framework-free
 * (plain strings) so it can back both the validator and the picker UI.
 */
export const ICON_NAMES = [
  'Home',
  'Utensils',
  'ShoppingCart',
  'UtensilsCrossed',
  'Car',
  'Zap',
  'HeartPulse',
  'ShoppingBag',
  'Gamepad2',
  'GraduationCap',
  'Plane',
  'Wallet',
  'Gift',
  'HandCoins',
  'CircleDashed',
] as const

export type IconName = (typeof ICON_NAMES)[number]

/**
 * The colors a user may pick (P5-01) — `--cat-*` CSS-var references so they
 * track the light/dark palette automatically (mirrors `CAT_COLORS` below). An
 * allowlist, not free-form hex, keeps the visual system coherent and closes an
 * injection surface (the value is interpolated into inline `style`).
 */
export const CATEGORY_COLORS = [
  'var(--cat-blue)',
  'var(--cat-teal)',
  'var(--cat-violet)',
  'var(--cat-amber)',
  'var(--cat-rose)',
  'var(--cat-lime)',
] as const

export type CategoryColor = (typeof CATEGORY_COLORS)[number]

/** The seed cycles through the same palette a user can pick from. */
const CAT_COLORS = CATEGORY_COLORS

/** Icon per top-level default category; subcategories inherit the parent's. */
const TOP_LEVEL_ICONS: Record<string, string> = {
  housing: 'Home',
  food: 'Utensils',
  transport: 'Car',
  utilities: 'Zap',
  health: 'HeartPulse',
  shopping: 'ShoppingBag',
  entertainment: 'Gamepad2',
  education: 'GraduationCap',
  travel: 'Plane',
  other_expense: FALLBACK_ICON_NAME,
  salary: 'Wallet',
  gifts: 'Gift',
  other_income: FALLBACK_ICON_NAME,
}

/** Subcategories that diverge from their parent's icon (most don't). */
const CHILD_ICON_OVERRIDES: Record<string, string> = {
  groceries: 'ShoppingCart',
  restaurants: 'UtensilsCrossed',
}

function buildIconMap(): Record<string, CategoryIconEntry> {
  const map: Record<string, CategoryIconEntry> = {}
  DEFAULT_CATEGORIES.forEach((category, i) => {
    const color = CAT_COLORS[i % CAT_COLORS.length] ?? CAT_COLORS[0]
    const parentIconName = TOP_LEVEL_ICONS[category.key] ?? FALLBACK_ICON_NAME
    map[category.key] = { iconName: parentIconName, color }
    for (const child of category.children ?? []) {
      map[child.key] = {
        iconName: CHILD_ICON_OVERRIDES[child.key] ?? parentIconName,
        color,
      }
    }
  })
  return map
}

/** `name_key` → { iconName, color } for every default category. */
export const DEFAULT_CATEGORY_ICONS: Readonly<
  Record<string, CategoryIconEntry>
> = buildIconMap()
