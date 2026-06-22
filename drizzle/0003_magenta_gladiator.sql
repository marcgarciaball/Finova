CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"amount_cents" bigint NOT NULL,
	"currency" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"note" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"is_transfer" boolean DEFAULT false NOT NULL,
	"transfer_group_id" uuid,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_amount_nonzero_check" CHECK ("transactions"."amount_cents" <> 0),
	CONSTRAINT "transactions_currency_check" CHECK ("transactions"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "transactions_description_check" CHECK (char_length(trim("transactions"."description")) between 1 and 200),
	CONSTRAINT "transactions_note_check" CHECK ("transactions"."note" is null or char_length("transactions"."note") <= 2000),
	CONSTRAINT "transactions_transfer_group_check" CHECK ("transactions"."is_transfer" = ("transactions"."transfer_group_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_user_id_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_account_id_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_category_id_idx" ON "transactions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "transactions_user_occurred_idx" ON "transactions" USING btree ("user_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_transfer_group_idx" ON "transactions" USING btree ("transfer_group_id") WHERE "transactions"."transfer_group_id" is not null;--> statement-breakpoint
CREATE POLICY "transactions_select_own" ON "transactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "transactions"."user_id");--> statement-breakpoint
CREATE POLICY "transactions_insert_own" ON "transactions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "transactions"."user_id");--> statement-breakpoint
CREATE POLICY "transactions_update_own" ON "transactions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "transactions"."user_id") WITH CHECK ((select auth.uid()) = "transactions"."user_id");--> statement-breakpoint
CREATE POLICY "transactions_delete_own" ON "transactions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "transactions"."user_id");--> statement-breakpoint

-- Hand-added: keep updated_at fresh on every UPDATE. Reuses the
-- public.set_updated_at() function created in 0000_broad_raider.sql.
CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();