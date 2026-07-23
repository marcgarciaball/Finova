/** Enumerations shared by the manual-assets schema, validation, and UI. */

export const MANUAL_ASSET_TYPES = [
  'bond',
  'private_equity',
  'p2p_lending',
  'collectible',
  'other',
] as const
export type ManualAssetType = (typeof MANUAL_ASSET_TYPES)[number]

export const MANUAL_VALUATION_SOURCES = ['manual', 'other'] as const
export type ManualValuationSource = (typeof MANUAL_VALUATION_SOURCES)[number]
