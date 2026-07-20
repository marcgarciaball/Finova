ALTER TABLE "accounts" ADD COLUMN "import_fingerprint" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "import_fingerprint" text;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_user_fingerprint_unique" ON "accounts" USING btree ("user_id","import_fingerprint") WHERE "accounts"."import_fingerprint" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_fingerprint_unique" ON "categories" USING btree ("user_id","import_fingerprint") WHERE "categories"."import_fingerprint" is not null;