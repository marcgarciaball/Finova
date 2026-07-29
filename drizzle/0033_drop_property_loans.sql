INSERT INTO "debts" (
  "id", "user_id", "type", "property_id", "lender", "currency",
  "principal_cents", "outstanding_cents", "interest_rate_pct", "rate_type",
  "term_months", "start_date", "payment_cents", "status", "notes",
  "import_fingerprint", "created_at", "updated_at"
)
SELECT
  "id",
  "user_id",
  'mortgage',
  "property_id",
  "lender_name",
  "currency",
  "original_amount_cents",
  "outstanding_cents",
  "interest_rate_pct",
  "rate_type",
  CASE
    WHEN "end_date" IS NOT NULL THEN GREATEST(
      1,
      (EXTRACT(YEAR FROM "end_date") - EXTRACT(YEAR FROM "start_date")) * 12
        + (EXTRACT(MONTH FROM "end_date") - EXTRACT(MONTH FROM "start_date"))
    )::integer
    ELSE 360
  END,
  "start_date",
  "monthly_payment_cents",
  CASE WHEN "is_paid_off" THEN 'paid_off' ELSE 'active' END,
  CASE
    WHEN "loan_type" <> 'mortgage'
      THEN 'Migrated from property loan (' || "loan_type" || ')' || COALESCE(' - ' || "notes", '')
    ELSE "notes"
  END,
  "import_fingerprint",
  "created_at",
  "updated_at"
FROM "property_loans";--> statement-breakpoint
DROP POLICY "property_loans_select_own" ON "property_loans" CASCADE;--> statement-breakpoint
DROP POLICY "property_loans_insert_own" ON "property_loans" CASCADE;--> statement-breakpoint
DROP POLICY "property_loans_update_own" ON "property_loans" CASCADE;--> statement-breakpoint
DROP POLICY "property_loans_delete_own" ON "property_loans" CASCADE;--> statement-breakpoint
DROP TABLE "property_loans" CASCADE;