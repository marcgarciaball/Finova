ALTER TABLE "properties" ADD COLUMN "import_fingerprint" text;--> statement-breakpoint
ALTER TABLE "property_expenses" ADD COLUMN "import_fingerprint" text;--> statement-breakpoint
ALTER TABLE "property_loans" ADD COLUMN "import_fingerprint" text;--> statement-breakpoint
ALTER TABLE "property_valuations" ADD COLUMN "import_fingerprint" text;--> statement-breakpoint
ALTER TABLE "rental_income" ADD COLUMN "import_fingerprint" text;--> statement-breakpoint
CREATE UNIQUE INDEX "properties_user_fingerprint_unique" ON "properties" USING btree ("user_id","import_fingerprint") WHERE "properties"."import_fingerprint" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "property_expenses_user_fingerprint_unique" ON "property_expenses" USING btree ("user_id","import_fingerprint") WHERE "property_expenses"."import_fingerprint" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "property_loans_user_fingerprint_unique" ON "property_loans" USING btree ("user_id","import_fingerprint") WHERE "property_loans"."import_fingerprint" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "property_valuations_user_fingerprint_unique" ON "property_valuations" USING btree ("user_id","import_fingerprint") WHERE "property_valuations"."import_fingerprint" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "rental_income_user_fingerprint_unique" ON "rental_income" USING btree ("user_id","import_fingerprint") WHERE "rental_income"."import_fingerprint" is not null;