CREATE TABLE "error_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"level" text DEFAULT 'error' NOT NULL,
	"message" text NOT NULL,
	"digest" text,
	"stack" text,
	"context" jsonb,
	CONSTRAINT "error_logs_level_check" CHECK ("error_logs"."level" in ('info', 'warn', 'error'))
);
--> statement-breakpoint
ALTER TABLE "error_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "error_logs_occurred_at_idx" ON "error_logs" USING btree ("occurred_at");--> statement-breakpoint

-- Hand-added: private DB-backup storage bucket (P5-05). Drizzle does not
-- model storage.buckets/storage.objects, so it's created here, alongside
-- error_logs, as this migration's other self-hosted-ops addition. No object
-- policies are added — storage.objects already has RLS enabled by Supabase,
-- so with zero policies for this bucket, ONLY the service-role client
-- (scripts/backup-db.mjs, scripts/restore-db.mjs) can read or write it.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('db-backups', 'db-backups', false, 524288000)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;