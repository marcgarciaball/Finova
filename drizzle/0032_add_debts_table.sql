CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"property_id" uuid,
	"lender" text NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"principal_cents" bigint NOT NULL,
	"outstanding_cents" bigint NOT NULL,
	"interest_rate_pct" numeric(6, 3) NOT NULL,
	"rate_type" text NOT NULL,
	"term_months" bigint NOT NULL,
	"start_date" date NOT NULL,
	"payment_cents" bigint NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"import_fingerprint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debts_type_check" CHECK ("debts"."type" in ('mortgage', 'car_loan', 'personal_loan', 'credit_card', 'other')),
	CONSTRAINT "debts_property_id_check" CHECK ("debts"."property_id" is null or "debts"."type" = 'mortgage'),
	CONSTRAINT "debts_rate_type_check" CHECK ("debts"."rate_type" in ('fixed', 'variable', 'mixed')),
	CONSTRAINT "debts_status_check" CHECK ("debts"."status" in ('active', 'paid_off', 'defaulted')),
	CONSTRAINT "debts_currency_check" CHECK ("debts"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "debts_principal_check" CHECK ("debts"."principal_cents" >= 0),
	CONSTRAINT "debts_outstanding_check" CHECK ("debts"."outstanding_cents" >= 0),
	CONSTRAINT "debts_term_months_check" CHECK ("debts"."term_months" > 0),
	CONSTRAINT "debts_payment_check" CHECK ("debts"."payment_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "debts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "debts_user_fingerprint_unique" ON "debts" USING btree ("user_id","import_fingerprint") WHERE "debts"."import_fingerprint" is not null;--> statement-breakpoint
CREATE INDEX "debts_user_id_idx" ON "debts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "debts_property_id_idx" ON "debts" USING btree ("property_id");--> statement-breakpoint
CREATE POLICY "debts_select_own" ON "debts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "debts"."user_id");--> statement-breakpoint
CREATE POLICY "debts_insert_own" ON "debts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "debts"."user_id");--> statement-breakpoint
CREATE POLICY "debts_update_own" ON "debts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "debts"."user_id") WITH CHECK ((select auth.uid()) = "debts"."user_id");--> statement-breakpoint
CREATE POLICY "debts_delete_own" ON "debts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "debts"."user_id");