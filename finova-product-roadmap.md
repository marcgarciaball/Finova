# Finova — Product Roadmap & Phased Build Plan

> **Vision:** Finova is where you add all your money sources, see your spending, and understand _how_ and _why_ you spend. A complete Spendee-class personal finance app — but modern, Apple-clean, and smarter: it doesn't just show charts, it tells you what's happening and what to do next.
>
> **North star:** one beautiful dashboard where you see every account, your whole money picture, and — at a glance — where your money goes, how you spend over time, what's leaking, and whether you're on track.
>
> **Strategy:** Ship in phases. The MVP must be genuinely useful on day one so people _want_ to use it — even without bank connections. Bank sync is powerful but heavy (PSD2 aggregators, compliance), so it is deliberately deferred to a later phase.

---

## How to read this document

This is the **product** plan: what we're building, in what order, and why. The granular engineering execution (one ticket = one PR, with RLS tests, migrations, and design specs) lives in [`PROGRESS.md`](PROGRESS.md) — this roadmap maps each product capability back to that work.

**Status legend**

| Mark | Meaning |
| ---- | ------- |
| ✅ | **Done** — built, tested, and verified. |
| 🔨 | **Built (verify)** — code complete and unit-tested; awaiting final browser/QA verification. |
| 🟡 | **Partial** — the engine/pure core is built and tested, but the user-facing UI (or a dependency) is still pending. |
| ⬜ | **Not started.** |

> Many Phase 0–4 items are 🔨 rather than ✅ because they were built and unit-tested in a sandbox where the app can't be launched. They need a manual browser pass (each engineering phase ends in a "Gate" for exactly this) before flipping to ✅.

---

## Where we are today (snapshot)

**The whole manual-first backbone exists.** A user can already, in code:

- sign up (magic link), in **ES or EN**, behind Row-Level-Security so they only ever see their own data;
- create **accounts/wallets** (cash, checking, savings, card) with currency and opening balance, and see each account's **live balance**;
- add, edit, delete, search, and filter **transactions** (income/expense, notes, tags, per-transaction currency);
- use a **bilingual default category tree** (two levels) plus a **rules engine** that auto-categorizes;
- **import** a CSV/Excel statement through a column-mapping wizard (with ready-made **bank adapters** for ING, BBVA, Revolut, CaixaBank), **review** new/duplicate/error rows, and **commit once** (idempotent — re-importing changes nothing);
- see a real **dashboard**: net cash flow, savings rate, balances, spending-by-category donut, income-vs-expense and balance-trend charts, and recent transactions with quick filters;
- **export** everything to CSV and JSON.

**What's missing for a finished MVP:** the settings/management UI (edit categories & rules, profile, base currency), JSON import + Google Sheets export, transaction duplicate/quick-add and the full transfer wizard, a richer "key stats" strip on the dashboard (average spend, biggest expense, busiest day), account deletion (GDPR), and the final i18n / a11y / security / polish passes.

**Then come the differentiators:** budgets & goals (Phase 2), smart insights (Phase 3), sharing & multi-currency & location (Phase 4), the Hardening & Release pass (Phase 5), and finally bank sync (Phase 6).

---

## Guiding principles

- **Useful from minute one.** A new user with zero data should get value within 5 minutes (quick add + import + first insight).
- **Manual-first, automation-later.** Until bank sync arrives, fast manual entry and CSV/Excel/JSON import are the data backbone — and must be excellent.
- **Insight over data.** Every screen should answer a question, not just display numbers.
- **Bilingual from day one.** ES/EN with locale-aware number, date and currency formatting.
- **Money is never a float.** All amounts are integer cents + ISO currency, enforced as a tested invariant; **no FX rate is ever invented.** This is a deliberate stance, not a gap: until a real rate source is wired, the user always sees **per-currency totals** (each currency tallied on its own), never a fabricated consolidated number.
- **Privacy and trust.** Encryption, secure auth, RLS, and clear data ownership (export/delete anytime).
- **One coherent visual system.** Apple-clean, off-white, soft glass cards, midnight-blue brand `#1E3A8A`.

---

## Phase overview

| Phase | Name | Goal | Status | Bank sync? |
| ----- | ---- | ---- | ------ | ---------- |
| **0** | Foundation | Auth, data model, i18n, design system | 🔨 **mostly built** | No |
| **1** | **MVP — "Track & Understand"** | Add money manually + import, categorize, see where money goes | 🟡 **~80% built** | No |
| **2** | Budgets & Goals | Budgets, savings goals, alerts | ⬜ Not started | No |
| **3** | Smart Insights | The differentiators: trends, forecast, leak finder | ⬜ Not started | No |
| **4** | Wallets & Sharing | Shared wallets, multi-currency, events, location | ⬜ (multi-currency 🟡) | No |
| **5** | Hardening & Release | Settings, GDPR, i18n/a11y/security/perf passes, legal — takes the built MVP to shippable | ⬜ Not started | No |
| **6** | Bank Connections | Automatic transaction import via PSD2 aggregator | ⬜ Not started | **Yes** |
| **7** | Beyond | Crypto/e-wallets, receipts/OCR, advanced AI coaching, native apps | ⬜ Not started | Yes |

---

# Phase 0 — Foundation (pre-MVP) — 🔨 mostly built

Technical groundwork everything else depends on.

- 🔨 **Auth**: email magic link (PKCE) + optional password. _Magic link + a hardened PKCE/OAuth callback are in place (open-redirect fixed, rate-limited)._ **Google OAuth provider is post-MVP; magic link is the MVP auth path** — _the callback is already OAuth-ready, so enabling the Google provider button is a fast-follow, not a release blocker._
- ✅ **Database**: Postgres with Row Level Security (each user sees only their data). _Drizzle + Supabase; default-deny RLS on every table, isolation proven by an RLS test suite._
- ✅ **Core data model**: users, accounts/wallets, transactions, categories, rules. _All shipped as schema + RLS: `profiles`, `accounts`, `categories` (two-level), `transactions`, `categorization_rules`, plus `import_templates` & `import_batches`. (Budgets/goals tables arrive in Phase 2.)_
- 🔨 **i18n setup**: ES/EN, locale-aware currency/number/date formatting. _next-intl (cookie-based), money formatting via `Intl`; a final "no missing keys" pass is P5-03._
- 🟡 **Design system**: tokens, glass cards, charts, components. _CSS-var tokens, `components/charts` (Area/Bar/Donut) and `components/dashboard` primitives (Hero/KPI/ListRow/NavRail) exist; the system keeps maturing as new surfaces land._
- 🟡 **App shell**: side icon rail, top bar, responsive layout (desktop + mobile web). _Localized nav shell + rail in place; responsive/mobile polish is P5-06._
- ⬜ **Settings**: profile, language, base currency, theme (light/dark). _Language switch works; the settings surface itself is P5-01._
- 🟡 **Data ownership**: full account export and permanent account deletion. _Export to CSV/JSON is built (🔨); permanent account deletion is P5-02._

---

# Phase 1 — MVP: "Track & Understand" — 🟡 ~80% built

**Goal:** The smallest version people genuinely love. You can put all your money in, organize it, and instantly see how and where you spend — no bank connection needed.

### 1.1 Accounts & wallets (manual) — ✅

- ✅ Create manual accounts/wallets (cash, checking, savings, card) with name, type, currency, starting balance.
- ✅ Multiple wallets per user.
- ✅ Per-wallet and total balance. _Live balance = opening + Σ transactions (transfers included); never sums across currencies._
- ⬜ **Manual balance reconciliation**: adjust an account when the real balance doesn't match the derived "opening + Σ transactions" (e.g. a forgotten expense) — records a balancing adjustment rather than silently editing history. _Small effort, high trust._

### 1.2 Transactions — 🟡

- ✅ Add expense / income manually (amount, category, wallet, date, note). _Sign of the amount is the source of truth for income vs. expense._
- 🟡 Fast "quick add" flow (few taps/clicks). _A full create form exists; a streamlined 1-tap quick-add is a polish item._
- 🟡 Edit, delete, **duplicate** a transaction. _Edit + delete done; "duplicate" not yet built._
- 🟡 Transfers between wallets. _Transfer rows are stored, rendered, filtered, and correctly excluded from income/expense totals; the two-leg "move money A→B" wizard is still pending._
- ✅ Search and filter (by date, category, wallet, amount, text). _URL-driven, shareable filters._
- ✅ Optional note and tags per transaction.

### 1.3 Categories — 🟡

- ✅ Default category set (food, transport, rent, leisure, income, etc.), bilingual. _13 parents + subcategories, seeded on signup._
- 🟡 Custom categories (name, icon, color). _Schema + validation ready; the create/edit UI is consolidated into Settings (P5-01)._
- ✅ Subcategories. _Two-level tree (`parent_id`), cascade on delete._
- ✅ Income vs. expense category types.

### 1.4 Auto-categorization (lightweight, no bank) — 🟡

- ✅ Simple rules engine: "if description contains X → category Y". _Pure matcher (description/amount/account clauses, priority, enable/disable); 27 bilingual default rules seeded on signup; applied automatically on import._
- 🟡 Suggested category based on past entries for the same merchant/text. _Suggestion core built ("make this a rule" token extraction); the UI control is P5-01._
- 🟡 One-tap correction that the system remembers. _Inline recategorize works today; turning a correction into a remembered rule is wired in core, UI pending (P5-01)._

### 1.5 Import / Export (the data backbone for MVP) — 🟡

- 🔨 Import transactions from CSV (column-mapping wizard). _Full pipeline: upload → auto-map (header heuristics + saved templates) → live preview → review (new/duplicate/error counts) → idempotent commit._
- 🔨 Import from **Excel** (.xlsx/.xls). _Added on top of the original plan (SheetJS); handles bank exports with preamble rows._
- 🔨 **Bank adapters** — ING, BBVA, Revolut, CaixaBank auto-detected. _Bonus beyond the original MVP scope; falls back to the generic mapping wizard for unknown layouts._
- ⬜ Import from JSON.
- 🔨 Export all data to CSV and JSON. _RLS-scoped; CSV round-trips cleanly back through import._
- ⬜ Export to a connected Google Sheet.
- ✅ Duplicate detection on import. _Deterministic fingerprint + fuzzy (Levenshtein) fallback; re-importing the same file is a no-op._

### 1.6 Dashboard & overview — 🟡

> **Status truth:** the individual charts and cards below exist, but the **unified, complete, single-screen experience does not** — that's the top gap, addressed by the "Unified Dashboard v1" workstream above. The items here are the building blocks, not the finished command center.

- ✅ At-a-glance: total income vs. expenses this month. _Period selector (30d/90d/YTD/12m/all)._
- ✅ "Do I spend less than I earn?" answered in one view (net cash flow). _Hero card with net + sparkline._
- ✅ Spending by category (donut/bar chart). _Per currency; uncategorized surfaced as its own bucket._
- ✅ Spending over time (line/bar by month). _Income-vs-expense bars + cumulative balance-trend area._
- ✅ Current balance across all wallets. _Per-account list + total per currency._
- 🟡 Key stats: total spent, average spend, biggest expense, busiest day. _Total spent / income / net / savings rate done; **average spend, biggest expense, and busiest day are not yet built** (see North Star §A)._
- ✅ Recent transactions list. _Newest 8 + income/expense/transfer quick-filter chips._
- ✅ Empty states with next actions, bilingual. _Add-account / import CTAs on a fresh account._

### 1.7 Foundations carried from Phase 0 — 🔨

- 🔨 Bilingual ES/EN, light/dark, responsive, secure auth, export. _Working; final i18n/a11y/responsive/security passes are Phase 5. Permanent delete is P5-02._

### 1.8 Onboarding & first-run — ⬜

_Honors the "value within 5 minutes" principle: a brand-new user with zero data should reach a first insight fast._

- ⬜ Welcome wizard on first sign-in (what Finova is, ES/EN).
- ⬜ Create the first wallet inline (the empty state already hints at this; the wizard makes it the first guided step).
- ⬜ Optional sample/demo data the user can load (and later clear) to explore the dashboard before importing anything real.
- ⬜ A guided path to **first import + first insight** — import a statement, see it categorized, land on a dashboard that already says something.

**MVP Definition of Done:** A user can add wallets, add/import transactions, have them categorized (manually + simple rules), and see a clear dashboard of how and where they spend — in ES or EN, on desktop and mobile web, with their data exportable anytime.

> **Done ≠ shippable. MVP DoD = all Phase 1 items + Phase 5 hardening.** "~80% built" measures code, not ship-readiness: the Phase 5 Hardening & Release pass (settings, GDPR, i18n/a11y/security/perf/legal) is part of the bar, not an afterthought.

**Remaining for MVP done:** Settings surface (manage categories & rules, profile, base currency — P5-01), JSON import + Google Sheets export, transaction duplicate + quick-add + transfer wizard, the extra dashboard key-stats, account deletion (P5-02), and the Phase-5 hardening passes (i18n / a11y / security / polish / legal).

---

# ⭐ North Star — The Complete Dashboard

> **The unified dashboard is the #1 product priority — it _is_ the product.** It's the single screen where a user sees their entire financial picture and decides how to change their spending, and it's the main reason people will choose Finova and keep using it. In one tab you must see all your assets, all your accounts and their balances, all your spending across accounts, _how_ you spend, how much you save, and your progression over months — so people can actually change their habits and be efficient with their money. **Today it's not close:** the individual charts exist, but the unified, single-screen command center does not. Closing that gap is the top of the roadmap (see "Unified Dashboard v1" below), ahead of every later-phase feature.

This is the destination the whole roadmap points at: **one screen that answers "how am I doing, and where does my money go?"** Below is every panel we want, grouped, with current status. Items marked ⬜/🟡 here are delivered by the phase noted.

### A. Money health (top of page)
- ✅ **Net cash flow** for the selected period (income − expenses).
- ✅ **Savings rate** as a headline health metric (net ÷ income).
- ✅ **Total balance** across all wallets (+ per-account breakdown).
- 🟡 **Key-stats strip**: total spent ✅ · **average daily/transaction spend** ⬜ · **biggest single expense** ⬜ · **busiest day** ⬜ · transaction count ⬜. _(Phase 1 polish — small pure-core additions to the dashboard domain.)_

### B. Where the money goes
- ✅ **Spending-by-category donut** with % share and amounts, period-aware.
- ✅ **Category table** with drill-in, uncategorized bucket surfaced.
- 🟡 **Subcategory drill-down** (tap a category → its subcategories). _(Phase 1.3 — tree exists, drill UI to add.)_
- ⬜ **Top merchants / "where you spend most"** list. _(Phase 3 — leans on the merchant tokenizer already built.)_
- ⬜ **Places map** — spend by location. _(Phase 4 — needs location per transaction.)_

### C. Trends over time
- ✅ **Income vs. expense** bar chart by month.
- ✅ **Balance trend** area chart (cumulative).
- ⬜ **Day/week granularity** toggle. _(Phase 1 polish / Phase 4.)_
- ⬜ **Weekly comparison** ("this week vs. last", ±%). _(Phase 3.)_
- ⬜ **Seasonal comparison** (this month vs. same month last year). _(Phase 3.)_
- ⬜ **Spending heatmap by weekday/hour** (busiest patterns). _(Phase 3.)_

### D. Control & guidance
- ⬜ **Budgets progress** (per category, % used, safe-to-spend/day). _(Phase 2.)_
- ⬜ **Savings goals** progress. _(Phase 2.)_
- ⬜ **Subscription radar / recurring charges**. _(Phase 3.)_
- ⬜ **Money-leak finder** ("recoverable per month"). _(Phase 3.)_
- ⬜ **Natural-language insight narrative** ("Dining up 3 months running…"). _(Phase 3.)_
- ⬜ **Cash-flow forecast & safe-to-spend-today**. _(Phase 3.)_
- ⬜ **Anomaly / unusual-spike alerts**. _(Phase 3.)_

### E. Activity & people
- ✅ **Recent transactions** with quick filters.
- ⬜ **Scheduled / upcoming** transactions & bills. _(Phase 2 reminders.)_
- ⬜ **People / who-paid-what** in shared wallets. _(Phase 4.)_

> The MVP dashboard already covers **A (most), B (core), C (core), and E (recent activity)**. Phases 2–5 fill in budgets, the insight narratives, location/people, and the comparison views that turn a good dashboard into the "complete" one. (Bank sync stays out of scope until Phase 6.)

---

# 🚀 Unified Dashboard v1 — the immediate next workstream — ⬜

> **Top priority. This is sequenced now — the immediate next workstream after the current Phase 1 remainder — NOT deferred to Phase 3.** Today the dashboard is a set of disconnected cards; v1 upgrades it into ONE cohesive command center on a single screen. The individual charts mostly exist; the bulk of this work is **composition + visual cohesion**, not building from zero. The Phase 3 insight panels (narratives, forecast, leak finder) then **layer onto this dashboard later** — they are not a substitute for it.

Everything below lives on **one screen**, all driven by a single period selector:

- 🟡 **Accounts strip** — every account (cash, checking, savings, card) with its balance side by side, plus **total net worth across accounts (per currency)**. _Per-account balance list + per-currency total already exist (✅ data); the work is the side-by-side strip composition._
- ✅ **Net worth / balance progression over months** (line/area trend). _Exists (balance-trend area); work is placement + visual cohesion._
- ✅ **Income vs. expense by month** (bars). _Exists; composition only._
- ✅ **Spending by category** (donut + %). _Exists; composition only._
- 🟡 **Top-categories ranking** ("where you spend most"). _The category table is already sorted by spend (✅ data); a dedicated ranking view is the new piece._
- ⬜ **Spending across accounts** — how each account contributes to total spend. _New; not built._
- ✅ **Savings rate + net cash flow** as headline health metrics. _Both exist; composition only._
- ⬜ **Key-stats strip** — average spend, biggest expense, busiest day, transaction count. _Only "total spent" exists today; **average spend / biggest expense / busiest day / count are not built** (the missing Phase 1 stats, North Star §A)._
- ✅ **Recent activity** with quick filters. _Exists; composition only._
- ✅ **Period selector** (30d / 90d / YTD / 12m / all) that drives every panel. _Exists; v1 makes it drive **every** panel coherently._
- 🟡 **Coherent visual system** — Apple-clean, off-white, soft glass cards, midnight-blue `#1E3A8A`, responsive, light/dark. _Design primitives exist and keep maturing; v1 is where they become one cohesive system across the whole screen._

_Engineering tickets for this workstream live in [`PROGRESS.md`](PROGRESS.md) under "Unified Dashboard v1"._

---

# Phase 2 — Budgets & Goals — ⬜ Not started

**Goal:** Move from _seeing_ spending to _controlling_ it.

### 2.1 Budgets
- ⬜ Budgets per category and/or per wallet.
- ⬜ Multiple budgets (monthly, custom periods).
- ⬜ Progress bar and % used.
- ⬜ "Safe to spend per day" to stay within budget.
- ⬜ Budget rollover (optional unused amount to next period).

### 2.2 Savings goals
- ⬜ Create goals (e.g. "save 8,000 EUR by year-end", "400 EUR/month").
- ⬜ Progress tracking toward each goal.
- ⬜ Target date and pace ("on track / behind").

### 2.3 Alerts & reminders
- ⬜ Budget near-limit and over-limit alerts.
- ⬜ Bill / payment reminders (feeds the dashboard's "scheduled/upcoming" panel).
- ⬜ Configurable channels (in-app, email) per alert type.

### 2.4 Recurring & scheduled transactions
- ⬜ A first-class recurring/scheduled-transaction concept (define a cadence, generate or forecast future entries). _Shared foundation for bills & reminders (2.3), Phase 3's **subscription radar**, and the Phase 3 **cash-flow forecast** — build it once here._

_New data model work: `budgets`, `goals`, and the recurring/scheduled-transaction tables above._

---

# Phase 3 — Smart Insights (the differentiators) — ⬜ Not started

**Goal:** This is where Finova beats Spendee and the rest. Turn data into guidance. _(The pure rules/tokenizer cores from Phase 1 are reusable building blocks here.)_

- ⬜ **Natural-language trend narratives**: weekly plain-language insight, e.g. "Dining has risen 3 months in a row (+35% this quarter); at this pace you'll end the year ~480 EUR over."
- ⬜ **Per-category trend score**: up/down/flat semaphore showing where each category is heading.
- ⬜ **Cash-flow forecast + "safe-to-spend today"**: project end-of-month/year balance from recurring income, fixed costs and average variable spend.
- ⬜ **Money-leak finder**: group ant-expenses, forgotten subscriptions and fees into one "recoverable per month" figure.
- ⬜ **Subscription radar**: detect recurring charges, flag price increases.
- ⬜ **Anomaly detection**: alert on unusual spikes or duplicates.
- ⬜ **Auto-suggested budgets**: realistic per-category budgets from 3-month history + seasonality.
- ⬜ **What-if simulator**: "If I cut dining 20%, I reach my goal 6 weeks sooner."
- ⬜ **AI goal coaching**: concrete cut suggestions tied to real data.
- ⬜ **Seasonal comparison**: this month vs. same month last year.
- ⬜ **Top-merchants & spending-pattern views** (weekday/hour heatmap) for the dashboard.
- ⬜ **Savings-rate narrative**: a natural-language read on the savings rate ("you saved 18% this month, up from 12%…"). _The metric itself already ships (✅ — surfaced as a headline number on the dashboard); Phase 3 only adds the narrative around it._
- ⬜ **Weekly/monthly money digest**: auto summary in-app and optionally by email.

---

# Phase 4 — Wallets & Sharing — ⬜ (multi-currency 🟡)

**Goal:** Match Spendee's collaborative and multi-currency features.

- ⬜ **Shared wallets** for couples, family, roommates (who paid what, totals) → powers the dashboard "people" panel.
- ⬜ **Event wallets** (holidays, wedding) you can share.
- 🟡 **Multi-currency** with base-currency normalization and daily FX. _Per-transaction currency + per-currency totals already ship; base-currency consolidation is deliberately deferred until a real FX rate source is wired (we never invent a rate)._
- ⬜ **Per-member visibility / permissions** in shared spaces.
- ⬜ **Photo attachment** per transaction.
- ⬜ **Location** per transaction → powers the dashboard "places map".
- ⬜ **Net worth tracking**: accounts + cash + manual assets/liabilities over time.

---

# Phase 5 — Hardening & Release (MVP finishing) — ⬜ Not started

> Tracked as engineering "Phase 5" in [`PROGRESS.md`](PROGRESS.md). These are the items that take the built MVP from "works in code" to "shippable."

- ⬜ **P5-01 Settings**: profile, base currency, **manage categories & rules** (this also unlocks the deferred Phase 1.3/1.4 management UIs).
- ⬜ **P5-02 Account deletion + data export (GDPR)**, end-to-end.
- ⬜ **P5-03 Full i18n pass**: no missing keys, dates/numbers localized everywhere (incl. auth pages).
- ⬜ **P5-04 Accessibility pass**: keyboard, focus, contrast, reduced motion.
- ⬜ **P5-05 Security audit & observability**: run the `security-review-checklist`; CSP nonce-hardening; shared/durable rate-limit store; **structured logging**, **error tracking** (e.g. Sentry), and **database backup/restore** in place — all required for the release gate.
- ⬜ **P5-06 Performance/polish**: loading states, error states, mobile responsive; **the transactions list and import must paginate/virtualize so multi-year statements (thousands of rows) stay fast.**
- ⬜ **P5-07 Legal**: privacy/terms + "not financial advice" notices.

**Release gate:** e2e smoke — sign up → import → categorize → dashboard → export → delete; observability (logging + error tracking) and a verified backup/restore are live.

---

# Phase 6 — Bank Connections (deferred, the big one) — ⬜ Not started

**Goal:** Automatic transaction import — what makes Spendee "connect all your accounts." Heavy and compliance-driven, so it comes after the product is already valuable.

- ⬜ **PSD2 aggregator integration** (e.g. GoCardless/Nordigen, Tink, or similar) — read-only access.
- ⬜ **Automatic transaction sync** from connected banks.
- ⬜ **Multi-country bank coverage** (start with Spain, expand).
- ⬜ **Auto-categorization on synced transactions** (reuse the Phase 1 rules engine).
- ⬜ **Read-only, token-based connection** with limited-lifetime authorization (never store bank passwords directly).
- ⬜ **Re-consent / connection refresh** handling (PSD2 90-day re-auth).
- ⬜ **Balance sync** alongside transactions.

> **Note:** Bank connection is explicitly out of scope until this phase (Phase 6). The MVP and Phases 2–5 must stand fully on manual entry + import/export — including the entire Hardening & Release pass.

---

# Phase 7 — Beyond — ⬜ Not started

**Goal:** Round out the full Spendee+ vision and push further.

- ⬜ **Crypto wallet tracking**.
- ⬜ **E-wallet connections** (PayPal, etc.).
- ⬜ **Receipt capture + OCR** (snap photo, auto-fill amount/merchant, attach).
- ⬜ **Advanced AI coaching** (personalized plans, scenario planning).
- ⬜ **Mobile apps** (native iOS/Android).
- ⬜ **Home-screen widget**.
- ⬜ **Biometric lock** (FaceID / fingerprint) + PIN.
- ⬜ **Cross-device sync & backup** at scale.
- ⬜ **Multi-channel alerts** (push, and optionally WhatsApp/Telegram).

---

## What's in vs. out for launch (quick reference)

**In the MVP (Phase 1):** manual wallets, manual + imported transactions (CSV/Excel + bank adapters), categories, simple auto-rules, CSV/JSON export, dashboard with how/where you spend, bilingual, light/dark, secure auth, export. **Most of this is already built** — what's left is the management UI, a few transaction/import niceties, the extra dashboard stats, and the Phase-5 hardening passes.

**Deliberately NOT in MVP:** bank connections, shared wallets, multi-currency consolidation, smart AI insights, receipts/OCR, crypto, native mobile apps. These are sequenced into later phases.

**The bet:** the MVP delivers Spendee's core understanding ("see how and why you spend") without the heavy bank-sync lift, and Phase 3 (smart insights) is what makes people switch _to_ Finova and stay.
