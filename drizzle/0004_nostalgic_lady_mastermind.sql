CREATE TABLE "import_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"header_signature" text NOT NULL,
	"name" text NOT NULL,
	"mapping" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "import_templates" ADD CONSTRAINT "import_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_templates_user_id_idx" ON "import_templates" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "import_templates_user_signature_key" ON "import_templates" USING btree ("user_id","header_signature");--> statement-breakpoint
CREATE POLICY "import_templates_select_own" ON "import_templates" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "import_templates"."user_id");--> statement-breakpoint
CREATE POLICY "import_templates_insert_own" ON "import_templates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "import_templates"."user_id");--> statement-breakpoint
CREATE POLICY "import_templates_update_own" ON "import_templates" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "import_templates"."user_id") WITH CHECK ((select auth.uid()) = "import_templates"."user_id");--> statement-breakpoint
CREATE POLICY "import_templates_delete_own" ON "import_templates" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "import_templates"."user_id");--> statement-breakpoint

-- Hand-added: keep updated_at fresh on every UPDATE. Reuses the
-- public.set_updated_at() function created in 0000_broad_raider.sql.
CREATE TRIGGER import_templates_set_updated_at
  BEFORE UPDATE ON public.import_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();