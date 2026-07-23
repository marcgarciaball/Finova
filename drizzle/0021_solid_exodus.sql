CREATE TABLE "manual_asset_valuations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"manual_asset_id" uuid NOT NULL,
	"valuation_date" date NOT NULL,
	"value_cents" bigint NOT NULL,
	"source" text DEFAULT 'manual',
	"notes" text,
	"import_fingerprint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_asset_valuations_asset_date_unique" UNIQUE("manual_asset_id","valuation_date"),
	CONSTRAINT "manual_asset_valuations_source_check" CHECK ("manual_asset_valuations"."source" is null or "manual_asset_valuations"."source" in ('manual', 'other')),
	CONSTRAINT "manual_asset_valuations_value_check" CHECK ("manual_asset_valuations"."value_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "manual_asset_valuations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "manual_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"acquisition_date" date NOT NULL,
	"cost_basis_cents" bigint NOT NULL,
	"current_value_cents" bigint NOT NULL,
	"last_valued_at" date NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"import_fingerprint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_assets_type_check" CHECK ("manual_assets"."type" in ('bond', 'private_equity', 'p2p_lending', 'collectible', 'other')),
	CONSTRAINT "manual_assets_currency_check" CHECK ("manual_assets"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "manual_assets_cost_basis_check" CHECK ("manual_assets"."cost_basis_cents" >= 0),
	CONSTRAINT "manual_assets_current_value_check" CHECK ("manual_assets"."current_value_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "manual_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "manual_asset_valuations" ADD CONSTRAINT "manual_asset_valuations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_asset_valuations" ADD CONSTRAINT "manual_asset_valuations_manual_asset_id_manual_assets_id_fk" FOREIGN KEY ("manual_asset_id") REFERENCES "public"."manual_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_assets" ADD CONSTRAINT "manual_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manual_asset_valuations_user_fingerprint_unique" ON "manual_asset_valuations" USING btree ("user_id","import_fingerprint") WHERE "manual_asset_valuations"."import_fingerprint" is not null;--> statement-breakpoint
CREATE INDEX "manual_asset_valuations_user_id_idx" ON "manual_asset_valuations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "manual_asset_valuations_asset_id_idx" ON "manual_asset_valuations" USING btree ("manual_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "manual_assets_user_fingerprint_unique" ON "manual_assets" USING btree ("user_id","import_fingerprint") WHERE "manual_assets"."import_fingerprint" is not null;--> statement-breakpoint
CREATE INDEX "manual_assets_user_id_idx" ON "manual_assets" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "manual_asset_valuations_select_own" ON "manual_asset_valuations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "manual_asset_valuations"."user_id");--> statement-breakpoint
CREATE POLICY "manual_asset_valuations_insert_own" ON "manual_asset_valuations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "manual_asset_valuations"."user_id");--> statement-breakpoint
CREATE POLICY "manual_asset_valuations_update_own" ON "manual_asset_valuations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "manual_asset_valuations"."user_id") WITH CHECK ((select auth.uid()) = "manual_asset_valuations"."user_id");--> statement-breakpoint
CREATE POLICY "manual_asset_valuations_delete_own" ON "manual_asset_valuations" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "manual_asset_valuations"."user_id");--> statement-breakpoint
CREATE POLICY "manual_assets_select_own" ON "manual_assets" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "manual_assets"."user_id");--> statement-breakpoint
CREATE POLICY "manual_assets_insert_own" ON "manual_assets" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "manual_assets"."user_id");--> statement-breakpoint
CREATE POLICY "manual_assets_update_own" ON "manual_assets" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "manual_assets"."user_id") WITH CHECK ((select auth.uid()) = "manual_assets"."user_id");--> statement-breakpoint
CREATE POLICY "manual_assets_delete_own" ON "manual_assets" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "manual_assets"."user_id");