# Finova — sample import data

Ready-to-import CSV statements for testing the import → review → commit pipeline
and the dashboard. All dates are in **2026 (Jan–Jun)** so the dashboard period
selector (30d / 90d / YTD / 12m) has something to show. Merchant names match the
built-in **default categorization rules**, so committed rows auto-categorize
(groceries, restaurants, transport, utilities, salary).

> **Note on bank auto-detection:** the bank adapters (ING / BBVA / CaixaBank /
> Revolut) exist and are tested in the domain, but are **not yet wired into the
> upload screen**. For now every file goes through the **generic column-mapping**
> step — you pick which column is the date / description / amount and choose the
> decimal + date format. The settings to use are listed per file below.

## How to import (each file)

1. Create an account first (e.g. "Checking", currency **EUR**) under **Accounts**.
2. Go to **Import**, upload one of the files below.
3. Map the columns as indicated, watch the live preview, then **Review**.
4. Pick the target account, confirm the new / duplicate / error counts, **Commit**.
5. Open the **Dashboard** to see balances, charts, and categories populate.

### `finova-sample-simple.csv` — easiest, start here
Comma-delimited, ISO dates, one signed amount column. 27 rows, Jan–Jun.

| Field | Map to | Setting |
|-------|--------|---------|
| Date | `Date` | format **YYYY-MM-DD** |
| Description | `Description` | — |
| Amount | `Amount` | **single** column, decimal **`.`**, negative = expense |

Currency falls back to the chosen account (EUR).

### `finova-sample-spanish-bank.csv` — ES locale (ING/BBVA-style)
`;`-delimited, `dd/mm/yyyy` dates, ES decimals (`1.850,00`), signed `Importe`.

| Field | Map to | Setting |
|-------|--------|---------|
| Date | `Fecha` | format **DD/MM/YYYY** |
| Description | `Concepto` | — |
| Amount | `Importe` | **single**, decimal **`,`**, negative = expense |

(`Saldo` is the running balance — leave it unmapped.)

### `finova-sample-debit-credit.csv` — two-column amounts (CaixaBank-style)
`;`-delimited, ES decimals. Spending is in `Cargo`, income in `Abono`.

| Field | Map to | Setting |
|-------|--------|---------|
| Date | `Fecha` | format **DD/MM/YYYY** |
| Description | `Concepto` | — |
| Amount | **debit/credit** | debit = `Cargo`, credit = `Abono`, decimal **`,`** |

### `finova-sample-revolut-multicurrency.csv` — multi-currency (Revolut-style)
Comma-delimited, ISO **datetimes**, dot decimals, a real `Currency` column with
EUR / USD / GBP rows — good for testing the dashboard's per-currency handling.

| Field | Map to | Setting |
|-------|--------|---------|
| Date | `Completed Date` | format **YYYY-MM-DD** (the time part is dropped) |
| Description | `Description` | — |
| Amount | `Amount` | **single**, decimal **`.`**, negative = expense |
| Currency | `Currency` | per-row currency |

## Things worth testing

- **Idempotency (the import gate):** import any file, commit, then import the
  **same file again** → Review should show every row as a **duplicate** and
  Commit should report `committed: 0`. No double-counting.
- **Auto-categorization:** after commit, open Transactions / Dashboard — rows
  like *Mercadona*, *Uber*, *Iberdrola*, *Nomina* land in their categories.
- **Multi-currency dashboard:** import the Revolut file into a EUR account and
  the dashboard shows one display currency plus a per-account balance list;
  it never sums across currencies.
- **Export round-trip:** **Export → Download CSV**, then re-import that file →
  it should re-import cleanly (and de-dup against what's already there).

## Real statements

You can also export a real CSV from your own bank (most Spanish banks and
Revolut offer "Export to CSV/Excel") and map it the same way. Excel (`.xlsx`) is
not supported yet — save/export as **CSV** first.
