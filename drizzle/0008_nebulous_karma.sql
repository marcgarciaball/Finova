ALTER TABLE "categorization_rules" ADD COLUMN "name_key" text;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "categorization_rules_user_name_key_uidx" ON "categorization_rules" USING btree ("user_id","name_key") WHERE "categorization_rules"."name_key" is not null;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Hand-added (P3-04): bilingual default categorization rules Drizzle can't
-- express. Mirrors lib/domain/rules/defaults.ts — keep the two in sync.
-- ---------------------------------------------------------------------------

-- Seed a user's default rules. SECURITY DEFINER so it inserts past RLS;
-- search_path pinned empty (all names schema-qualified). Each rule is a single
-- `description contains <token>` clause targeting a category resolved by its
-- name_key. Idempotent via the partial unique index on (user_id, name_key).
CREATE OR REPLACE FUNCTION public.seed_default_rules(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.categorization_rules
    (user_id, name, name_key, conditions, category_id, priority, is_default)
  SELECT
    p_user_id,
    v.name,
    v.name_key,
    jsonb_build_array(
      jsonb_build_object('field', 'description', 'op', 'contains', 'value', v.token)
    ),
    c.id,
    v.priority,
    true
  FROM (VALUES
    ('mercadona', 'Mercadona',         'groceries',   'mercadona',        100),
    ('carrefour', 'Carrefour',         'groceries',   'carrefour',        101),
    ('lidl',      'Lidl',              'groceries',   'lidl',             102),
    ('dia',       'Dia',               'groceries',   'supermercado dia', 103),
    ('aldi',      'Aldi',              'groceries',   'aldi',             104),
    ('consum',    'Consum',            'groceries',   'consum',           105),
    ('eroski',    'Eroski',            'groceries',   'eroski',           106),
    ('glovo',     'Glovo',             'restaurants', 'glovo',            110),
    ('uber_eats', 'Uber Eats',         'restaurants', 'uber eats',        111),
    ('just_eat',  'Just Eat',          'restaurants', 'just eat',         112),
    ('deliveroo', 'Deliveroo',         'restaurants', 'deliveroo',        113),
    ('mcdonalds', 'McDonald''s',       'restaurants', 'mcdonald',         114),
    ('starbucks', 'Starbucks',         'restaurants', 'starbucks',        115),
    ('telepizza', 'Telepizza',         'restaurants', 'telepizza',        116),
    ('uber',      'Uber',              'transport',   'uber',             120),
    ('cabify',    'Cabify',            'transport',   'cabify',           121),
    ('renfe',     'Renfe',             'transport',   'renfe',            122),
    ('repsol',    'Repsol',            'transport',   'repsol',           123),
    ('cepsa',     'Cepsa',             'transport',   'cepsa',            124),
    ('endesa',    'Endesa',            'utilities',   'endesa',           130),
    ('iberdrola', 'Iberdrola',         'utilities',   'iberdrola',        131),
    ('naturgy',   'Naturgy',           'utilities',   'naturgy',          132),
    ('movistar',  'Movistar',          'utilities',   'movistar',         133),
    ('vodafone',  'Vodafone',          'utilities',   'vodafone',         134),
    ('orange',    'Orange',            'utilities',   'orange',           135),
    ('nomina',    'Payroll (Nómina)',  'salary',      'nomina',           140),
    ('payroll',   'Payroll',           'salary',      'payroll',          141)
  ) AS v(name_key, name, category_key, token, priority)
  JOIN public.categories c
    ON c.user_id = p_user_id AND c.name_key = v.category_key
  ON CONFLICT (user_id, name_key) WHERE name_key IS NOT NULL DO NOTHING;
END;
$$;--> statement-breakpoint

-- Provision default rules when a new auth user is created. Named so it fires
-- AFTER on_auth_user_created_seed_categories (triggers run alphabetically by
-- name; 'categories' < 'rules'), since each rule resolves its category by
-- name_key and the categories must exist first.
CREATE OR REPLACE FUNCTION public.handle_new_user_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.seed_default_rules(NEW.id);
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER on_auth_user_created_seed_rules
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_rules();