# Finvia — Product Roadmap & Phased Build Plan

> **Vision:** Finvia is where you add all your money sources, see your spending, and understand _how_ and _why_ you spend. A complete Spendee-class personal finance app — but modern, Apple-clean, and smarter: it doesn't just show charts, it tells you what's happening and what to do next.
>
> **Strategy:** Ship in phases. The MVP must be genuinely useful on day one so people _want_ to use it — even without bank connections. Bank sync is powerful but heavy (PSD2 aggregators, compliance), so it is deliberately deferred to a later phase.

---

## Guiding principles

- **Useful from minute one.** A new user with zero data should get value within 5 minutes (quick add + import + first insight).
- **Manual-first, automation-later.** Until bank sync arrives, fast manual entry and CSV/JSON import are the data backbone — and must be excellent.
- **Insight over data.** Every screen should answer a question, not just display numbers.
- **Bilingual from day one.** ES/EN with locale-aware number, date and currency formatting.
- **Privacy and trust.** Encryption, secure auth, and clear data ownership (export/delete anytime).
- **One coherent visual system.** Apple-clean, off-white, soft glass cards, midnight-blue brand `#1E3A8A`.

---

## Phase overview

| Phase | Name                           | Goal                                                          | Bank sync? |
| ----- | ------------------------------ | ------------------------------------------------------------- | ---------- |
| **0** | Foundation                     | Auth, data model, i18n, design system                         | No         |
| **1** | **MVP — "Track & Understand"** | Add money manually + import, categorize, see where money goes | No         |
| **2** | Budgets & Goals                | Budgets, savings goals, alerts                                | No         |
| **3** | Smart Insights                 | The differentiators: trends, forecast, leak finder            | No         |
| **4** | Wallets & Sharing              | Shared wallets, multi-currency, events                        | No         |
| **5** | Bank Connections               | Automatic transaction import via PSD2 aggregator              | **Yes**    |
| **6** | Beyond                         | Crypto/e-wallets, receipts/OCR, advanced AI coaching          | Yes        |

---

# Phase 0 — Foundation (pre-MVP)

Technical groundwork everything else depends on.

- [ ] **Auth**: email magic link (PKCE) + Google OAuth + optional password.
- [ ] **Database**: Postgres with Row Level Security (each user sees only their data).
- [ ] **Core data model**: users, accounts/wallets, transactions, categories, rules.
- [ ] **i18n setup**: ES/EN, locale-aware currency/number/date formatting.
- [ ] **Design system**: tokens, glass cards, charts, components (the Finvia design skill).
- [ ] **App shell**: side icon rail, top bar, responsive layout (desktop + mobile web).
- [ ] **Settings**: profile, language, base currency, theme (light/dark).
- [ ] **Data ownership**: full account export and permanent account deletion.

---

# Phase 1 — MVP: "Track & Understand"

**Goal:** The smallest version people genuinely love. You can put all your money in, organize it, and instantly see how and where you spend — no bank connection needed.

### 1.1 Accounts & wallets (manual)

- [ ] Create manual accounts/wallets (cash, checking, savings, card) with name, type, currency, starting balance.
- [ ] Multiple wallets per user.
- [ ] Per-wallet and total balance.

### 1.2 Transactions

- [ ] Add expense / income manually (amount, category, wallet, date, note).
- [ ] Fast "quick add" flow (few taps/clicks).
- [ ] Edit, delete, duplicate a transaction.
- [ ] Transfers between wallets.
- [ ] Search and filter (by date, category, wallet, amount, text).
- [ ] Optional note and tags per transaction.

### 1.3 Categories

- [ ] Default category set (food, transport, rent, leisure, income, etc.), bilingual.
- [ ] Custom categories (name, icon, color).
- [ ] Subcategories (optional but recommended).
- [ ] Income vs. expense category types.

### 1.4 Auto-categorization (lightweight, no bank)

- [ ] Simple rules engine: "if description contains X -> category Y".
- [ ] Suggested category based on past entries for the same merchant/text.
- [ ] One-tap correction that the system remembers.

### 1.5 Import / Export (the data backbone for MVP)

- [ ] Import transactions from CSV (column mapping wizard).
- [ ] Import from JSON.
- [ ] Export all data to CSV and JSON.
- [ ] Export to a connected Google Sheet.
- [ ] Duplicate detection on import.

### 1.6 Dashboard & overview

- [ ] At-a-glance: total income vs. expenses this month.
- [ ] "Do I spend less than I earn?" answered in one view (net cash flow).
- [ ] Spending by category (donut/bar chart).
- [ ] Spending over time (line/bar by month).
- [ ] Current balance across all wallets.
- [ ] Key stats: total spent, average spend, biggest expense, busiest day.
- [ ] Recent transactions list.

### 1.7 Foundations carried from Phase 0

- [ ] Bilingual ES/EN, light/dark, responsive, secure auth, export/delete.

**MVP Definition of Done:** A user can add wallets, add/import transactions, have them categorized (manually + simple rules), and see a clear dashboard of how and where they spend — in ES or EN, on desktop and mobile web, with their data exportable anytime.

---

# Phase 2 — Budgets & Goals

**Goal:** Move from _seeing_ spending to _controlling_ it.

### 2.1 Budgets

- [ ] Budgets per category and/or per wallet.
- [ ] Multiple budgets (monthly, custom periods).
- [ ] Progress bar and % used.
- [ ] "Safe to spend per day" to stay within budget.
- [ ] Budget rollover (optional unused amount to next period).

### 2.2 Savings goals

- [ ] Create goals (e.g. "save 8,000 EUR by year-end", "400 EUR/month").
- [ ] Progress tracking toward each goal.
- [ ] Target date and pace ("on track / behind").

### 2.3 Alerts & reminders

- [ ] Budget near-limit and over-limit alerts.
- [ ] Bill / payment reminders.
- [ ] Configurable channels (in-app, email) per alert type.

---

# Phase 3 — Smart Insights (the differentiators)

**Goal:** This is where Finvia beats Spendee and the rest. Turn data into guidance.

- [ ] **Natural-language trend narratives**: weekly plain-language insight, e.g. "Dining has risen 3 months in a row (+35% this quarter); at this pace you'll end the year ~480 EUR over."
- [ ] **Per-category trend score**: up/down/flat semaphore showing where each category is heading.
- [ ] **Cash-flow forecast + "safe-to-spend today"**: project end-of-month/year balance from recurring income, fixed costs and average variable spend.
- [ ] **Money-leak finder**: group ant-expenses, forgotten subscriptions and fees into one "recoverable per month" figure.
- [ ] **Subscription radar**: detect recurring charges, flag price increases.
- [ ] **Anomaly detection**: alert on unusual spikes or duplicates.
- [ ] **Auto-suggested budgets**: realistic per-category budgets from 3-month history + seasonality.
- [ ] **What-if simulator**: "If I cut dining 20%, I reach my goal 6 weeks sooner."
- [ ] **AI goal coaching**: concrete cut suggestions tied to real data.
- [ ] **Seasonal comparison**: this month vs. same month last year.
- [ ] **Savings rate as hero metric**: surfaced prominently as the headline health number.
- [ ] **Weekly/monthly money digest**: auto summary in-app and optionally by email.

---

# Phase 4 — Wallets & Sharing

**Goal:** Match Spendee's collaborative and multi-currency features.

- [ ] **Shared wallets** for couples, family, roommates (who paid what, totals).
- [ ] **Event wallets** (holidays, wedding) you can share.
- [ ] **Multi-currency** with base-currency normalization and daily FX.
- [ ] **Per-member visibility / permissions** in shared spaces.
- [ ] **Photo attachment** per transaction.
- [ ] **Location** per transaction.
- [ ] **Net worth tracking**: accounts + cash + manual assets/liabilities over time.

---

# Phase 5 — Bank Connections (deferred, the big one)

**Goal:** Automatic transaction import — what makes Spendee "connect all your accounts." Heavy and compliance-driven, so it comes after the product is already valuable.

- [ ] **PSD2 aggregator integration** (e.g. GoCardless/Nordigen, Tink, or similar) — read-only access.
- [ ] **Automatic transaction sync** from connected banks.
- [ ] **Multi-country bank coverage** (start with Spain, expand).
- [ ] **Auto-categorization on synced transactions** (reuse Phase 1 engine).
- [ ] **Read-only, token-based connection** with limited-lifetime authorization (never store bank passwords directly).
- [ ] **Re-consent / connection refresh** handling (PSD2 90-day re-auth).
- [ ] **Balance sync** alongside transactions.

> **Note:** Bank connection is explicitly out of scope until this phase. The MVP and Phases 2–4 must stand fully on manual entry + import/export.

---

# Phase 6 — Beyond

**Goal:** Round out the full Spendee+ vision and push further.

- [ ] **Crypto wallet tracking**.
- [ ] **E-wallet connections** (PayPal, etc.).
- [ ] **Receipt capture + OCR** (snap photo, auto-fill amount/merchant, attach).
- [ ] **Advanced AI coaching** (personalized plans, scenario planning).
- [ ] **Mobile apps** (native iOS/Android).
- [ ] **Home-screen widget**.
- [ ] **Biometric lock** (FaceID / fingerprint) + PIN.
- [ ] **Cross-device sync & backup** at scale.
- [ ] **Multi-channel alerts** (push, and optionally WhatsApp/Telegram).

---

## What's in vs. out for launch (quick reference)

**In the MVP (Phase 1):** manual wallets, manual + imported transactions, categories, simple auto-rules, CSV/JSON/Sheets import-export, dashboard with how/where you spend, bilingual, light/dark, secure auth, export/delete.

**Deliberately NOT in MVP:** bank connections, shared wallets, multi-currency, smart AI insights, receipts/OCR, crypto, native mobile apps. These are sequenced into later phases.

**The bet:** the MVP delivers Spendee's core understanding ("see how and why you spend") without the heavy bank-sync lift, and Phase 3 is what makes people switch _to_ Finvia and stay.
