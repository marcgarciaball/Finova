CREATE TABLE "categorization_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"conditions" jsonb NOT NULL,
	"category_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categorization_rules_name_check" CHECK (char_length(trim("categorization_rules"."name")) between 1 and 100),
	CONSTRAINT "categorization_rules_priority_check" CHECK ("categorization_rules"."priority" >= 0)
);
--> statement-breakpoint
ALTER TABLE "categorization_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categorization_rules_user_id_idx" ON "categorization_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "categorization_rules_user_enabled_priority_idx" ON "categorization_rules" USING btree ("user_id","enabled","priority");--> statement-breakpoint
CREATE POLICY "categorization_rules_select_own" ON "categorization_rules" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "categorization_rules"."user_id");--> statement-breakpoint
CREATE POLICY "categorization_rules_insert_own" ON "categorization_rules" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "categorization_rules"."user_id");--> statement-breakpoint
CREATE POLICY "categorization_rules_update_own" ON "categorization_rules" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "categorization_rules"."user_id") WITH CHECK ((select auth.uid()) = "categorization_rules"."user_id");--> statement-breakpoint
CREATE POLICY "categorization_rules_delete_own" ON "categorization_rules" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "categorization_rules"."user_id");--> statement-breakpoint

-- Hand-added: keep updated_at fresh on every UPDATE. Reuses the
-- public.set_updated_at() function created in 0000_broad_raider.sql.
CREATE TRIGGER categorization_rules_set_updated_at
  BEFORE UPDATE ON public.categorization_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();