CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"address" text,
	"city" text,
	"country" text DEFAULT 'ES' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"purchase_date" date NOT NULL,
	"purchase_price_cents" bigint NOT NULL,
	"purchase_fees_cents" bigint DEFAULT 0 NOT NULL,
	"current_value_cents" bigint NOT NULL,
	"last_valued_at" date NOT NULL,
	"is_rented" boolean DEFAULT false NOT NULL,
	"rental_start_date" date,
	"rental_end_date" date,
	"is_sold" boolean DEFAULT false NOT NULL,
	"sold_date" date,
	"sold_price_cents" bigint,
	"sold_fees_cents" bigint DEFAULT 0,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_type_check" CHECK ("properties"."type" in ('primary_home', 'investment', 'vacation', 'land', 'commercial', 'other')),
	CONSTRAINT "properties_currency_check" CHECK ("properties"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "properties_purchase_price_check" CHECK ("properties"."purchase_price_cents" >= 0),
	CONSTRAINT "properties_purchase_fees_check" CHECK ("properties"."purchase_fees_cents" >= 0),
	CONSTRAINT "properties_current_value_check" CHECK ("properties"."current_value_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "property_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"expense_date" date NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurrence" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_expenses_category_check" CHECK ("property_expenses"."category" in ('mortgage_payment', 'property_tax', 'community_fee', 'insurance', 'maintenance', 'management_fee', 'utilities', 'legal', 'renovation', 'vacancy', 'other')),
	CONSTRAINT "property_expenses_recurrence_check" CHECK ("property_expenses"."recurrence" is null or "property_expenses"."recurrence" in ('monthly', 'quarterly', 'yearly')),
	CONSTRAINT "property_expenses_currency_check" CHECK ("property_expenses"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "property_expenses_amount_check" CHECK ("property_expenses"."amount_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "property_expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "property_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"lender_name" text NOT NULL,
	"loan_type" text NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"original_amount_cents" bigint NOT NULL,
	"outstanding_cents" bigint NOT NULL,
	"interest_rate_pct" numeric(6, 3) NOT NULL,
	"rate_type" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"monthly_payment_cents" bigint NOT NULL,
	"euribor_spread_pct" numeric(6, 3),
	"last_review_date" date,
	"notes" text,
	"is_paid_off" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_loans_loan_type_check" CHECK ("property_loans"."loan_type" in ('mortgage', 'equity_release', 'personal_loan', 'developer_loan', 'other')),
	CONSTRAINT "property_loans_rate_type_check" CHECK ("property_loans"."rate_type" in ('fixed', 'variable', 'mixed')),
	CONSTRAINT "property_loans_currency_check" CHECK ("property_loans"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "property_loans_original_amount_check" CHECK ("property_loans"."original_amount_cents" >= 0),
	CONSTRAINT "property_loans_outstanding_check" CHECK ("property_loans"."outstanding_cents" >= 0),
	CONSTRAINT "property_loans_monthly_payment_check" CHECK ("property_loans"."monthly_payment_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "property_loans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "property_valuations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"valuation_date" date NOT NULL,
	"value_cents" bigint NOT NULL,
	"source" text DEFAULT 'manual',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_valuations_property_date_unique" UNIQUE("property_id","valuation_date"),
	CONSTRAINT "property_valuations_source_check" CHECK ("property_valuations"."source" is null or "property_valuations"."source" in ('manual', 'appraisal', 'agent_estimate', 'zillow', 'idealista', 'other')),
	CONSTRAINT "property_valuations_value_check" CHECK ("property_valuations"."value_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "property_valuations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rental_income" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"tenant_name" text,
	"is_paid" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_income_currency_check" CHECK ("rental_income"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "rental_income_amount_check" CHECK ("rental_income"."amount_cents" >= 0),
	CONSTRAINT "rental_income_period_check" CHECK ("rental_income"."period_end" >= "rental_income"."period_start")
);
--> statement-breakpoint
ALTER TABLE "rental_income" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_expenses" ADD CONSTRAINT "property_expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_expenses" ADD CONSTRAINT "property_expenses_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_loans" ADD CONSTRAINT "property_loans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_loans" ADD CONSTRAINT "property_loans_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_valuations" ADD CONSTRAINT "property_valuations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_valuations" ADD CONSTRAINT "property_valuations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_income" ADD CONSTRAINT "rental_income_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_income" ADD CONSTRAINT "rental_income_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "properties_user_id_idx" ON "properties" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "property_expenses_user_id_idx" ON "property_expenses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "property_expenses_property_id_idx" ON "property_expenses" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_loans_user_id_idx" ON "property_loans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "property_loans_property_id_idx" ON "property_loans" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_valuations_user_id_idx" ON "property_valuations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "property_valuations_property_id_idx" ON "property_valuations" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "rental_income_user_id_idx" ON "rental_income" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rental_income_property_id_idx" ON "rental_income" USING btree ("property_id");--> statement-breakpoint
CREATE POLICY "properties_select_own" ON "properties" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "properties"."user_id");--> statement-breakpoint
CREATE POLICY "properties_insert_own" ON "properties" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "properties"."user_id");--> statement-breakpoint
CREATE POLICY "properties_update_own" ON "properties" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "properties"."user_id") WITH CHECK ((select auth.uid()) = "properties"."user_id");--> statement-breakpoint
CREATE POLICY "properties_delete_own" ON "properties" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "properties"."user_id");--> statement-breakpoint
CREATE POLICY "property_expenses_select_own" ON "property_expenses" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "property_expenses"."user_id");--> statement-breakpoint
CREATE POLICY "property_expenses_insert_own" ON "property_expenses" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "property_expenses"."user_id");--> statement-breakpoint
CREATE POLICY "property_expenses_update_own" ON "property_expenses" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "property_expenses"."user_id") WITH CHECK ((select auth.uid()) = "property_expenses"."user_id");--> statement-breakpoint
CREATE POLICY "property_expenses_delete_own" ON "property_expenses" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "property_expenses"."user_id");--> statement-breakpoint
CREATE POLICY "property_loans_select_own" ON "property_loans" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "property_loans"."user_id");--> statement-breakpoint
CREATE POLICY "property_loans_insert_own" ON "property_loans" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "property_loans"."user_id");--> statement-breakpoint
CREATE POLICY "property_loans_update_own" ON "property_loans" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "property_loans"."user_id") WITH CHECK ((select auth.uid()) = "property_loans"."user_id");--> statement-breakpoint
CREATE POLICY "property_loans_delete_own" ON "property_loans" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "property_loans"."user_id");--> statement-breakpoint
CREATE POLICY "property_valuations_select_own" ON "property_valuations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "property_valuations"."user_id");--> statement-breakpoint
CREATE POLICY "property_valuations_insert_own" ON "property_valuations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "property_valuations"."user_id");--> statement-breakpoint
CREATE POLICY "property_valuations_update_own" ON "property_valuations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "property_valuations"."user_id") WITH CHECK ((select auth.uid()) = "property_valuations"."user_id");--> statement-breakpoint
CREATE POLICY "property_valuations_delete_own" ON "property_valuations" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "property_valuations"."user_id");--> statement-breakpoint
CREATE POLICY "rental_income_select_own" ON "rental_income" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "rental_income"."user_id");--> statement-breakpoint
CREATE POLICY "rental_income_insert_own" ON "rental_income" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "rental_income"."user_id");--> statement-breakpoint
CREATE POLICY "rental_income_update_own" ON "rental_income" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "rental_income"."user_id") WITH CHECK ((select auth.uid()) = "rental_income"."user_id");--> statement-breakpoint
CREATE POLICY "rental_income_delete_own" ON "rental_income" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "rental_income"."user_id");