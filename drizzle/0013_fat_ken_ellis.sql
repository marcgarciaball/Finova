CREATE TABLE "holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"quantity" numeric(20, 8) NOT NULL,
	"avg_cost_cents" bigint NOT NULL,
	"invested_cents" bigint NOT NULL,
	"realized_pl_cents" bigint DEFAULT 0 NOT NULL,
	"current_price_cents" bigint,
	"current_value_cents" bigint,
	"unrealized_pl_cents" bigint,
	"unrealized_pl_pct" numeric(10, 4),
	"dividends_cents" bigint DEFAULT 0 NOT NULL,
	"last_computed_at" timestamp with time zone,
	CONSTRAINT "holdings_portfolio_asset_unique" UNIQUE("portfolio_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "holdings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"total_value_cents" bigint NOT NULL,
	"base_currency" text NOT NULL,
	CONSTRAINT "portfolio_snapshots_portfolio_date_unique" UNIQUE("portfolio_id","snapshot_date"),
	CONSTRAINT "portfolio_snapshots_base_currency_check" CHECK ("portfolio_snapshots"."base_currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "investment_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investment_accounts_currency_check" CHECK ("investment_accounts"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "investment_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text DEFAULT 'My Portfolio' NOT NULL,
	"base_currency" text DEFAULT 'EUR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolios_base_currency_check" CHECK ("portfolios"."base_currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "portfolios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"ticker" text,
	"isin" text,
	"coingecko_id" text,
	"exchange" text,
	"name" text NOT NULL,
	"currency" text NOT NULL,
	"provider_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_ticker_exchange_unique" UNIQUE("ticker","exchange"),
	CONSTRAINT "assets_isin_unique" UNIQUE("isin"),
	CONSTRAINT "assets_coingecko_id_unique" UNIQUE("coingecko_id"),
	CONSTRAINT "assets_type_check" CHECK ("assets"."type" in ('stock', 'etf', 'fund', 'crypto')),
	CONSTRAINT "assets_currency_check" CHECK ("assets"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cached_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"price_cents" bigint NOT NULL,
	"currency" text NOT NULL,
	"quote_type" text NOT NULL,
	"stale" boolean DEFAULT false NOT NULL,
	"provider" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cached_quotes_asset_id_unique" UNIQUE("asset_id"),
	CONSTRAINT "cached_quotes_quote_type_check" CHECK ("cached_quotes"."quote_type" in ('live', 'delayed', 'eod', 'nav', 'stale')),
	CONSTRAINT "cached_quotes_currency_check" CHECK ("cached_quotes"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "cached_quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "dividend_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"ex_date" date NOT NULL,
	"pay_date" date,
	"amount_per_share" numeric(12, 6) NOT NULL,
	"currency" text NOT NULL,
	"provider" text NOT NULL,
	CONSTRAINT "dividend_events_asset_ex_date_unique" UNIQUE("asset_id","ex_date"),
	CONSTRAINT "dividend_events_currency_check" CHECK ("dividend_events"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "dividend_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_ccy" text NOT NULL,
	"to_ccy" text NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"rate_date" date NOT NULL,
	CONSTRAINT "fx_rates_pair_date_unique" UNIQUE("from_ccy","to_ccy","rate_date"),
	CONSTRAINT "fx_rates_from_ccy_check" CHECK ("fx_rates"."from_ccy" ~ '^[A-Z]{3}$'),
	CONSTRAINT "fx_rates_to_ccy_check" CHECK ("fx_rates"."to_ccy" ~ '^[A-Z]{3}$'),
	CONSTRAINT "fx_rates_rate_check" CHECK ("fx_rates"."rate" > 0)
);
--> statement-breakpoint
ALTER TABLE "fx_rates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "historical_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"date" date NOT NULL,
	"open_cents" bigint,
	"high_cents" bigint,
	"low_cents" bigint,
	"close_cents" bigint NOT NULL,
	"volume" bigint,
	"currency" text NOT NULL,
	CONSTRAINT "historical_prices_asset_date_unique" UNIQUE("asset_id","date"),
	CONSTRAINT "historical_prices_currency_check" CHECK ("historical_prices"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "historical_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "investment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"account_id" uuid,
	"asset_id" uuid NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(20, 8) NOT NULL,
	"price_cents" bigint NOT NULL,
	"currency" text NOT NULL,
	"fees_cents" bigint DEFAULT 0 NOT NULL,
	"traded_at" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"edit_reason" text,
	CONSTRAINT "investment_transactions_type_check" CHECK ("investment_transactions"."type" in ('buy', 'sell')),
	CONSTRAINT "investment_transactions_quantity_check" CHECK ("investment_transactions"."quantity" > 0),
	CONSTRAINT "investment_transactions_price_check" CHECK ("investment_transactions"."price_cents" >= 0),
	CONSTRAINT "investment_transactions_fees_check" CHECK ("investment_transactions"."fees_cents" >= 0),
	CONSTRAINT "investment_transactions_currency_check" CHECK ("investment_transactions"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "investment_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_accounts" ADD CONSTRAINT "investment_accounts_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_accounts" ADD CONSTRAINT "investment_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cached_quotes" ADD CONSTRAINT "cached_quotes_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dividend_events" ADD CONSTRAINT "dividend_events_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_prices" ADD CONSTRAINT "historical_prices_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_account_id_investment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."investment_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "holdings_user_id_idx" ON "holdings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "portfolio_snapshots_user_id_idx" ON "portfolio_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "investment_accounts_user_id_idx" ON "investment_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "investment_accounts_portfolio_id_idx" ON "investment_accounts" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "portfolios_user_id_idx" ON "portfolios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "investment_transactions_user_id_idx" ON "investment_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "investment_transactions_portfolio_asset_idx" ON "investment_transactions" USING btree ("portfolio_id","asset_id");--> statement-breakpoint
CREATE POLICY "holdings_select_own" ON "holdings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "holdings"."user_id");--> statement-breakpoint
CREATE POLICY "portfolio_snapshots_select_own" ON "portfolio_snapshots" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "portfolio_snapshots"."user_id");--> statement-breakpoint
CREATE POLICY "investment_accounts_select_own" ON "investment_accounts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "investment_accounts"."user_id");--> statement-breakpoint
CREATE POLICY "investment_accounts_insert_own" ON "investment_accounts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "investment_accounts"."user_id");--> statement-breakpoint
CREATE POLICY "investment_accounts_update_own" ON "investment_accounts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "investment_accounts"."user_id") WITH CHECK ((select auth.uid()) = "investment_accounts"."user_id");--> statement-breakpoint
CREATE POLICY "investment_accounts_delete_own" ON "investment_accounts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "investment_accounts"."user_id");--> statement-breakpoint
CREATE POLICY "portfolios_select_own" ON "portfolios" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "portfolios"."user_id");--> statement-breakpoint
CREATE POLICY "portfolios_insert_own" ON "portfolios" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "portfolios"."user_id");--> statement-breakpoint
CREATE POLICY "portfolios_update_own" ON "portfolios" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "portfolios"."user_id") WITH CHECK ((select auth.uid()) = "portfolios"."user_id");--> statement-breakpoint
CREATE POLICY "portfolios_delete_own" ON "portfolios" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "portfolios"."user_id");--> statement-breakpoint
CREATE POLICY "assets_select_authenticated" ON "assets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "cached_quotes_select_authenticated" ON "cached_quotes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "dividend_events_select_authenticated" ON "dividend_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "fx_rates_select_authenticated" ON "fx_rates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "historical_prices_select_authenticated" ON "historical_prices" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "investment_transactions_select_own" ON "investment_transactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "investment_transactions"."user_id");--> statement-breakpoint
CREATE POLICY "investment_transactions_insert_own" ON "investment_transactions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "investment_transactions"."user_id");--> statement-breakpoint
CREATE POLICY "investment_transactions_update_own" ON "investment_transactions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "investment_transactions"."user_id") WITH CHECK ((select auth.uid()) = "investment_transactions"."user_id");--> statement-breakpoint
CREATE POLICY "investment_transactions_delete_own" ON "investment_transactions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "investment_transactions"."user_id");--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Hand-added: maintain updated_at (function defined in 0000).
-- ---------------------------------------------------------------------------
CREATE TRIGGER portfolios_set_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER investment_transactions_set_updated_at
  BEFORE UPDATE ON public.investment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER assets_set_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER cached_quotes_set_updated_at
  BEFORE UPDATE ON public.cached_quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
