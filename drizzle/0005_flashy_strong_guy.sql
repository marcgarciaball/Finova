CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"storage_path" text NOT NULL,
	"filename" text,
	"mime_type" text,
	"byte_size" bigint,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"mapping" jsonb,
	"counts" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_batches_storage_path_unique" UNIQUE("storage_path"),
	CONSTRAINT "import_batches_status_check" CHECK ("import_batches"."status" in ('uploaded', 'mapped', 'reviewed', 'committed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_batches_user_id_idx" ON "import_batches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "import_batches_user_created_idx" ON "import_batches" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "import_batches_select_own" ON "import_batches" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "import_batches"."user_id");--> statement-breakpoint
CREATE POLICY "import_batches_insert_own" ON "import_batches" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "import_batches"."user_id");--> statement-breakpoint
CREATE POLICY "import_batches_update_own" ON "import_batches" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "import_batches"."user_id") WITH CHECK ((select auth.uid()) = "import_batches"."user_id");--> statement-breakpoint
CREATE POLICY "import_batches_delete_own" ON "import_batches" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "import_batches"."user_id");--> statement-breakpoint

-- Hand-added: keep updated_at fresh on every UPDATE. Reuses the
-- public.set_updated_at() function created in 0000_broad_raider.sql.
CREATE TRIGGER import_batches_set_updated_at
  BEFORE UPDATE ON public.import_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint

-- Hand-added: private per-user import bucket. Drizzle does not model
-- storage.buckets / storage.objects, so the bucket and its object-level RLS are
-- created here. ON CONFLICT keeps the migration idempotent across environments.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'imports',
  'imports',
  false,
  5242880,
  ARRAY[
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;--> statement-breakpoint

-- Hand-added: storage.objects RLS — a user may only touch objects under their
-- own `${auth.uid()}/` prefix in the imports bucket (defense-in-depth behind the
-- app-layer checks). storage.objects already has RLS enabled by Supabase.
CREATE POLICY "imports_objects_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );--> statement-breakpoint
CREATE POLICY "imports_objects_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );--> statement-breakpoint
CREATE POLICY "imports_objects_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );--> statement-breakpoint
CREATE POLICY "imports_objects_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );