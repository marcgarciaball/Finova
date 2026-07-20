ALTER TABLE "investment_accounts" ADD COLUMN "import_fingerprint" text;--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "import_fingerprint" text;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD COLUMN "import_fingerprint" text;--> statement-breakpoint
CREATE UNIQUE INDEX "investment_accounts_user_fingerprint_unique" ON "investment_accounts" USING btree ("user_id","import_fingerprint") WHERE "investment_accounts"."import_fingerprint" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "portfolios_user_fingerprint_unique" ON "portfolios" USING btree ("user_id","import_fingerprint") WHERE "portfolios"."import_fingerprint" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "investment_transactions_user_fingerprint_unique" ON "investment_transactions" USING btree ("user_id","import_fingerprint") WHERE "investment_transactions"."import_fingerprint" is not null;