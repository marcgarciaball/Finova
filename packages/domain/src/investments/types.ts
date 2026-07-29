/** Inversiones (A1): closed vocabularies shared by schema, domain and UI. */
export const ASSET_TYPES = ['stock', 'etf', 'fund', 'crypto'] as const
export type AssetType = (typeof ASSET_TYPES)[number]

export const QUOTE_TYPES = ['live', 'delayed', 'eod', 'nav', 'stale'] as const
export type QuoteType = (typeof QUOTE_TYPES)[number]

export const INVESTMENT_TXN_TYPES = ['buy', 'sell'] as const
export type InvestmentTxnType = (typeof INVESTMENT_TXN_TYPES)[number]

export const FUNDING_SOURCES = ['own_funds', 'credit'] as const
export type FundingSource = (typeof FUNDING_SOURCES)[number]
