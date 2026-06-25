CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"currency" text NOT NULL,
	"opening_balance" bigint DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_name_check" CHECK (char_length(trim("accounts"."name")) between 1 and 100),
	CONSTRAINT "accounts_type_check" CHECK ("accounts"."type" in ('checking', 'savings', 'cash', 'credit_card', 'investment')),
	CONSTRAINT "accounts_currency_check" CHECK ("accounts"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "accounts_select_own" ON "accounts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "accounts"."user_id");--> statement-breakpoint
CREATE POLICY "accounts_insert_own" ON "accounts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "accounts"."user_id");--> statement-breakpoint
CREATE POLICY "accounts_update_own" ON "accounts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "accounts"."user_id") WITH CHECK ((select auth.uid()) = "accounts"."user_id");--> statement-breakpoint
CREATE POLICY "accounts_delete_own" ON "accounts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "accounts"."user_id");--> statement-breakpoint

-- Hand-added: keep updated_at fresh on every UPDATE. Reuses the
-- public.set_updated_at() function created in 0000_broad_raider.sql.
CREATE TRIGGER accounts_set_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();