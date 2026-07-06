import { describe, expect, it } from 'vitest'
import {
  assetRowSchema,
  cachedQuoteRowSchema,
  fxRateRowSchema,
  holdingRowSchema,
  investmentAccountRowSchema,
  investmentTransactionRowSchema,
  portfolioRowSchema,
  portfolioSnapshotRowSchema,
} from './investments'

const uuid = '11111111-1111-4111-8111-111111111111'
const ts = '2026-01-01T00:00:00Z'

const asset = {
  id: uuid,
  type: 'stock',
  ticker: 'AAPL',
  isin: 'US0378331005',
  coingecko_id: null,
  exchange: 'NASDAQ',
  name: 'Apple Inc.',
  currency: 'USD',
  provider_meta: {},
  created_at: ts,
  updated_at: ts,
}

const txn = {
  id: uuid,
  user_id: uuid,
  portfolio_id: uuid,
  account_id: null,
  asset_id: uuid,
  type: 'buy',
  quantity: 1.5,
  price_cents: 19000,
  currency: 'USD',
  fees_cents: 100,
  traded_at: '2026-01-02',
  notes: null,
  created_at: ts,
  updated_at: ts,
  edited_at: null,
  edit_reason: null,
}

describe('assetRowSchema', () => {
  it('accepts a stock row', () => {
    expect(assetRowSchema.parse(asset)).toEqual(asset)
  })
  it('rejects an unknown type', () => {
    expect(assetRowSchema.safeParse({ ...asset, type: 'bond' }).success).toBe(
      false
    )
  })
  it('rejects a bad currency', () => {
    expect(
      assetRowSchema.safeParse({ ...asset, currency: 'usd' }).success
    ).toBe(false)
  })
})

describe('investmentTransactionRowSchema', () => {
  it('accepts a buy row and coerces numeric-as-string quantity', () => {
    expect(
      investmentTransactionRowSchema.parse({ ...txn, quantity: '1.50000000' })
        .quantity
    ).toBe(1.5)
  })
  it('rejects non-positive quantity', () => {
    expect(
      investmentTransactionRowSchema.safeParse({ ...txn, quantity: 0 }).success
    ).toBe(false)
  })
  it('rejects more than 8 decimal places', () => {
    expect(
      investmentTransactionRowSchema.safeParse({
        ...txn,
        quantity: 0.000000001,
      }).success
    ).toBe(false)
  })
  it('rejects an unknown txn type', () => {
    expect(
      investmentTransactionRowSchema.safeParse({ ...txn, type: 'short' })
        .success
    ).toBe(false)
  })
  it('rejects non-integer cents', () => {
    expect(
      investmentTransactionRowSchema.safeParse({ ...txn, price_cents: 1.5 })
        .success
    ).toBe(false)
  })
})

describe('remaining row schemas', () => {
  it('portfolioRowSchema round-trips', () => {
    const row = {
      id: uuid,
      user_id: uuid,
      name: 'My Portfolio',
      base_currency: 'EUR',
      created_at: ts,
      updated_at: ts,
    }
    expect(portfolioRowSchema.parse(row)).toEqual(row)
  })
  it('investmentAccountRowSchema round-trips', () => {
    const row = {
      id: uuid,
      portfolio_id: uuid,
      user_id: uuid,
      name: 'DEGIRO',
      currency: 'EUR',
      created_at: ts,
    }
    expect(investmentAccountRowSchema.parse(row)).toEqual(row)
  })
  it('holdingRowSchema accepts nullable price fields', () => {
    const row = {
      id: uuid,
      user_id: uuid,
      portfolio_id: uuid,
      asset_id: uuid,
      quantity: 10,
      avg_cost_cents: 19100,
      invested_cents: 191000,
      realized_pl_cents: 0,
      current_price_cents: null,
      current_value_cents: null,
      unrealized_pl_cents: null,
      unrealized_pl_pct: null,
      dividends_cents: 0,
      last_computed_at: null,
    }
    expect(holdingRowSchema.parse(row)).toEqual(row)
  })
  it('cachedQuoteRowSchema rejects an unknown quote_type', () => {
    const row = {
      id: uuid,
      asset_id: uuid,
      price_cents: 100,
      currency: 'USD',
      quote_type: 'realtime',
      stale: false,
      provider: 'finnhub',
      fetched_at: ts,
      updated_at: ts,
    }
    expect(cachedQuoteRowSchema.safeParse(row).success).toBe(false)
  })
  it('portfolioSnapshotRowSchema round-trips', () => {
    const row = {
      id: uuid,
      portfolio_id: uuid,
      user_id: uuid,
      snapshot_date: '2026-01-02',
      total_value_cents: 123456,
      base_currency: 'EUR',
    }
    expect(portfolioSnapshotRowSchema.parse(row)).toEqual(row)
  })
  it('fxRateRowSchema rejects a non-positive rate', () => {
    const row = {
      id: uuid,
      from_ccy: 'USD',
      to_ccy: 'EUR',
      rate: 0,
      rate_date: '2026-01-02',
    }
    expect(fxRateRowSchema.safeParse(row).success).toBe(false)
  })
})
