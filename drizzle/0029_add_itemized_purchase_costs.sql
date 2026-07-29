ALTER TABLE "properties" ADD COLUMN "transfer_tax_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "notary_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "registry_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "agency_fee_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "renovation_cost_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "other_purchase_costs_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_transfer_tax_check" CHECK ("properties"."transfer_tax_cents" >= 0);--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_notary_check" CHECK ("properties"."notary_cents" >= 0);--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_registry_check" CHECK ("properties"."registry_cents" >= 0);--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_agency_fee_check" CHECK ("properties"."agency_fee_cents" >= 0);--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_renovation_cost_check" CHECK ("properties"."renovation_cost_cents" >= 0);--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_other_purchase_costs_check" CHECK ("properties"."other_purchase_costs_cents" >= 0);--> statement-breakpoint
-- Preserve existing purchase-fees totals as "other costs" so cost basis is unchanged.
UPDATE "properties" SET "other_purchase_costs_cents" = "purchase_fees_cents";