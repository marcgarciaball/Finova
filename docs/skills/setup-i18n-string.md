# Skill: setup-i18n-string

**Trigger:** any time you add user-facing text. No hardcoded strings, ever (Definition of Done #3). Both `es` and `en` must be updated together — a key in one catalog but not the other is a bug.

## How i18n works here (cookie-based, no URL routing)

- Locale comes from the `NEXT_LOCALE` cookie, default `es` (`lib/i18n/config.ts`), resolved per request in `lib/i18n/request.ts`.
- Catalogs: `messages/en.json` and `messages/es.json`, keyed by feature namespace (`app`, `common`, `landing`, `locale`, …).
- The `LocaleSwitcher` writes the cookie via the `setLocale` server action and refreshes.
- No `[locale]` route segment — the URL never carries the locale (ADR-004, revised).

## Steps to add a string

1. **Pick a namespace + key.** Group by feature: `transactions.title`, `import.reviewHeading`. Reuse `common.*` for shared words (Save, Cancel, Sign in).
2. **Add it to BOTH catalogs** — `messages/en.json` and `messages/es.json` — with the same key path. Write a real translation, not a copy of the English.
3. **Reference it, never inline literals:**
   - Server Component: `const t = useTranslations(); … t('transactions.title')`
   - Client Component: same `useTranslations()` from `next-intl`.
   - Server Action / outside React: `const t = await getTranslations()` from `next-intl/server`.
4. **Interpolation / plurals:** use ICU syntax in the catalog — `"count": "{n, plural, one {# item} other {# items}}"` — and pass values: `t('count', { n })`. Don't build sentences by string concatenation (word order differs across languages).
5. **Dates & numbers:** format with `useFormatter()` / `next-intl` formatters or `Intl.*`, never hand-format — locale decides separators and order. Money still flows through `lib/domain/money` (cents + currency); i18n only handles *display*.

## Checklist

- [ ] Key exists in **both** `en.json` and `es.json` (same path).
- [ ] No hardcoded user-facing literal in the component/action.
- [ ] Real translation in each language (not a placeholder/copy).
- [ ] Interpolation/plurals via ICU args, not concatenation.
- [ ] Dates/numbers/currency formatted via a formatter, not by hand.
- [ ] `aria-label`/alt text are also translated.

## Guard against drift

The full-i18n pass (P5-03) checks that every key in one catalog exists in the other and that no key is missing at runtime. Keep catalogs in sync as you go so that pass is a no-op.
