ALTER TABLE "investment_transactions" ADD COLUMN "funding_source" text DEFAULT 'own_funds' NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD COLUMN "funding_note" text;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_funding_source_check" CHECK ("investment_transactions"."funding_source" in ('own_funds', 'credit'));