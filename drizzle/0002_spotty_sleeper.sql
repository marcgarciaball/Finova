CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"name_key" text,
	"kind" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_check" CHECK (char_length(trim("categories"."name")) between 1 and 100),
	CONSTRAINT "categories_kind_check" CHECK ("categories"."kind" in ('income', 'expense'))
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_user_id_idx" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_name_key_uidx" ON "categories" USING btree ("user_id","name_key") WHERE "categories"."name_key" is not null;--> statement-breakpoint
CREATE POLICY "categories_select_own" ON "categories" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "categories"."user_id");--> statement-breakpoint
CREATE POLICY "categories_insert_own" ON "categories" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "categories"."user_id");--> statement-breakpoint
CREATE POLICY "categories_update_own" ON "categories" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "categories"."user_id") WITH CHECK ((select auth.uid()) = "categories"."user_id");--> statement-breakpoint
CREATE POLICY "categories_delete_own" ON "categories" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "categories"."user_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Hand-added (P1-03): triggers + bilingual default seed Drizzle can't express.
-- ---------------------------------------------------------------------------

-- Keep updated_at fresh on every UPDATE (reuses public.set_updated_at(), 0000).
CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint

-- Seed a user's default category tree. SECURITY DEFINER so it inserts past RLS;
-- search_path pinned empty (all names schema-qualified). Idempotent via the
-- partial unique index on (user_id, name_key). Mirrors
-- lib/domain/categories/defaults.ts — keep the two in sync.
CREATE OR REPLACE FUNCTION public.seed_default_categories(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Top-level categories.
  INSERT INTO public.categories (user_id, name, name_key, kind, is_default) VALUES
    (p_user_id, 'Housing',       'housing',       'expense', true),
    (p_user_id, 'Food & Dining', 'food',          'expense', true),
    (p_user_id, 'Transport',     'transport',     'expense', true),
    (p_user_id, 'Utilities',     'utilities',     'expense', true),
    (p_user_id, 'Health',        'health',        'expense', true),
    (p_user_id, 'Shopping',      'shopping',      'expense', true),
    (p_user_id, 'Entertainment', 'entertainment', 'expense', true),
    (p_user_id, 'Education',     'education',     'expense', true),
    (p_user_id, 'Travel',        'travel',        'expense', true),
    (p_user_id, 'Other',         'other_expense', 'expense', true),
    (p_user_id, 'Salary',        'salary',        'income',  true),
    (p_user_id, 'Gifts',         'gifts',         'income',  true),
    (p_user_id, 'Other income',  'other_income',  'income',  true)
  ON CONFLICT (user_id, name_key) WHERE name_key IS NOT NULL DO NOTHING;

  -- Subcategories — parent resolved by name_key; kind inherited from parent.
  INSERT INTO public.categories (user_id, parent_id, name, name_key, kind, is_default)
  SELECT p_user_id, p.id, v.name, v.name_key, p.kind, true
  FROM (VALUES
    ('rent',        'Rent',        'housing'),
    ('mortgage',    'Mortgage',    'housing'),
    ('groceries',   'Groceries',   'food'),
    ('restaurants', 'Restaurants', 'food')
  ) AS v(name_key, name, parent_key)
  JOIN public.categories p
    ON p.user_id = p_user_id AND p.name_key = v.parent_key AND p.parent_id IS NULL
  ON CONFLICT (user_id, name_key) WHERE name_key IS NOT NULL DO NOTHING;
END;
$$;--> statement-breakpoint

-- Provision the default tree when a new auth user is created. Separate from
-- handle_new_user so profile + category seeding stay independent.
CREATE OR REPLACE FUNCTION public.handle_new_user_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.seed_default_categories(NEW.id);
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER on_auth_user_created_seed_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_categories();