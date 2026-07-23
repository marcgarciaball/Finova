CREATE TABLE "manual_asset_income" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"manual_asset_id" uuid NOT NULL,
	"received_date" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"notes" text,
	"import_fingerprint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_asset_income_amount_check" CHECK ("manual_asset_income"."amount_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "manual_asset_income" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "manual_asset_income" ADD CONSTRAINT "manual_asset_income_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_asset_income" ADD CONSTRAINT "manual_asset_income_manual_asset_id_manual_assets_id_fk" FOREIGN KEY ("manual_asset_id") REFERENCES "public"."manual_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manual_asset_income_user_fingerprint_unique" ON "manual_asset_income" USING btree ("user_id","import_fingerprint") WHERE "manual_asset_income"."import_fingerprint" is not null;--> statement-breakpoint
CREATE INDEX "manual_asset_income_user_id_idx" ON "manual_asset_income" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "manual_asset_income_asset_id_idx" ON "manual_asset_income" USING btree ("manual_asset_id");--> statement-breakpoint
CREATE POLICY "manual_asset_income_select_own" ON "manual_asset_income" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "manual_asset_income"."user_id");--> statement-breakpoint
CREATE POLICY "manual_asset_income_insert_own" ON "manual_asset_income" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "manual_asset_income"."user_id");--> statement-breakpoint
CREATE POLICY "manual_asset_income_update_own" ON "manual_asset_income" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "manual_asset_income"."user_id") WITH CHECK ((select auth.uid()) = "manual_asset_income"."user_id");--> statement-breakpoint
CREATE POLICY "manual_asset_income_delete_own" ON "manual_asset_income" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "manual_asset_income"."user_id");