/**
 * Content fingerprints for round-trip investments import (Spec C). Like the
 * real-estate ones, these are id-independent `fnv1a` hashes. Assets are the
 * wrinkle: the file carries a minimal asset reference, and the same security
 * lives under different DB ids across environments, so transactions identify
 * their asset by a stable **symbol key** (CoinGecko id → ticker+exchange →
 * ISIN → name), never by id.
 */

import type {
  InvestmentAccountRow,
  InvestmentTransactionRow,
  PortfolioRow,
} from '@/lib/validation/investments'
import { fnv1a } from '../fingerprint'

export interface AssetIdentity {
  coingecko_id: string | null
  exchange: string | null
  isin: string | null
  name: string
  ticker: string | null
}

/** Stable, id-independent identity for an asset (matches on re-import). */
export function assetKey(a: AssetIdentity): string {
  if (a.coingecko_id) return `cg:${a.coingecko_id}`
  if (a.ticker) return `tk:${a.ticker}:${a.exchange ?? ''}`
  if (a.isin) return `is:${a.isin}`
  return `nm:${a.name}`
}

export function portfolioFingerprint(
  p: Pick<PortfolioRow, 'name' | 'base_currency'>
): string {
  return fnv1a([p.name, p.base_currency].join('|'))
}

export function accountFingerprint(
  parentFp: string,
  a: Pick<InvestmentAccountRow, 'name' | 'currency'>
): string {
  return fnv1a([parentFp, a.name, a.currency].join('|'))
}

export function investmentTxnFingerprint(
  parentFp: string,
  assetSymbol: string,
  t: Pick<
    InvestmentTransactionRow,
    'type' | 'traded_at' | 'quantity' | 'price_cents' | 'currency'
  >
): string {
  // Normalize the numerics: Postgres returns numeric/bigint as strings
  // ("10.00000000"), incoming rows are numbers (10) — `Number` canonicalizes
  // both to the same token so a re-import fingerprints identically.
  return fnv1a(
    [
      parentFp,
      assetSymbol,
      t.type,
      t.traded_at,
      Number(t.quantity),
      Number(t.price_cents),
      t.currency,
    ].join('|')
  )
}
