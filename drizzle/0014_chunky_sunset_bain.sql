CREATE TABLE "sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_state" ENABLE ROW LEVEL SECURITY;