ALTER TABLE "categories" ADD COLUMN "icon_name" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "color" text;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Hand-added (P4 category icons): re-seed defaults with icon/color, backfill
-- existing rows. Mirrors lib/domain/categories/icons.ts — keep in sync.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_default_categories(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Top-level categories.
  INSERT INTO public.categories (user_id, name, name_key, kind, is_default, icon_name, color) VALUES
    (p_user_id, 'Housing',       'housing',       'expense', true, 'Home',          'var(--cat-blue)'),
    (p_user_id, 'Food & Dining', 'food',          'expense', true, 'Utensils',      'var(--cat-teal)'),
    (p_user_id, 'Transport',     'transport',     'expense', true, 'Car',           'var(--cat-violet)'),
    (p_user_id, 'Utilities',     'utilities',     'expense', true, 'Zap',           'var(--cat-amber)'),
    (p_user_id, 'Health',        'health',        'expense', true, 'HeartPulse',    'var(--cat-rose)'),
    (p_user_id, 'Shopping',      'shopping',      'expense', true, 'ShoppingBag',   'var(--cat-lime)'),
    (p_user_id, 'Entertainment', 'entertainment', 'expense', true, 'Gamepad2',      'var(--cat-blue)'),
    (p_user_id, 'Education',     'education',     'expense', true, 'GraduationCap','var(--cat-teal)'),
    (p_user_id, 'Travel',        'travel',        'expense', true, 'Plane',         'var(--cat-violet)'),
    (p_user_id, 'Other',         'other_expense', 'expense', true, 'CircleDashed',  'var(--cat-amber)'),
    (p_user_id, 'Salary',        'salary',        'income',  true, 'Wallet',        'var(--cat-rose)'),
    (p_user_id, 'Gifts',         'gifts',         'income',  true, 'Gift',          'var(--cat-lime)'),
    (p_user_id, 'Other income',  'other_income',  'income',  true, 'CircleDashed',  'var(--cat-blue)')
  ON CONFLICT (user_id, name_key) WHERE name_key IS NOT NULL DO NOTHING;

  -- Subcategories — parent resolved by name_key; kind inherited from parent.
  INSERT INTO public.categories (user_id, parent_id, name, name_key, kind, is_default, icon_name, color)
  SELECT p_user_id, p.id, v.name, v.name_key, p.kind, true, v.icon_name, p.color
  FROM (VALUES
    ('rent',        'Rent',        'housing', 'Home'),
    ('mortgage',    'Mortgage',    'housing', 'Home'),
    ('groceries',   'Groceries',   'food',    'ShoppingCart'),
    ('restaurants', 'Restaurants', 'food',    'UtensilsCrossed')
  ) AS v(name_key, name, parent_key, icon_name)
  JOIN public.categories p
    ON p.user_id = p_user_id AND p.name_key = v.parent_key AND p.parent_id IS NULL
  ON CONFLICT (user_id, name_key) WHERE name_key IS NOT NULL DO NOTHING;
END;
$$;--> statement-breakpoint

-- Backfill: default categories seeded before this migration have no icon/color
-- yet. One-time UPDATE per known name_key so existing users get icons too.
UPDATE public.categories SET icon_name = 'Home',           color = 'var(--cat-blue)'   WHERE name_key = 'housing'       AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'Home',           color = 'var(--cat-blue)'   WHERE name_key = 'rent'          AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'Home',           color = 'var(--cat-blue)'   WHERE name_key = 'mortgage'      AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'Utensils',       color = 'var(--cat-teal)'   WHERE name_key = 'food'          AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'ShoppingCart',   color = 'var(--cat-teal)'   WHERE name_key = 'groceries'     AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'UtensilsCrossed',color = 'var(--cat-teal)'   WHERE name_key = 'restaurants'   AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'Car',            color = 'var(--cat-violet)' WHERE name_key = 'transport'     AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'Zap',            color = 'var(--cat-amber)'  WHERE name_key = 'utilities'     AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'HeartPulse',     color = 'var(--cat-rose)'   WHERE name_key = 'health'        AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'ShoppingBag',    color = 'var(--cat-lime)'   WHERE name_key = 'shopping'      AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'Gamepad2',       color = 'var(--cat-blue)'   WHERE name_key = 'entertainment' AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'GraduationCap',  color = 'var(--cat-teal)'   WHERE name_key = 'education'     AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'Plane',          color = 'var(--cat-violet)' WHERE name_key = 'travel'        AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'CircleDashed',   color = 'var(--cat-amber)'  WHERE name_key = 'other_expense' AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'Wallet',         color = 'var(--cat-rose)'   WHERE name_key = 'salary'        AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'Gift',           color = 'var(--cat-lime)'   WHERE name_key = 'gifts'         AND icon_name IS NULL;--> statement-breakpoint
UPDATE public.categories SET icon_name = 'CircleDashed',   color = 'var(--cat-blue)'   WHERE name_key = 'other_income'  AND icon_name IS NULL;
