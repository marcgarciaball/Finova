import { z } from 'zod'
import { ASSET_TYPES, type AssetType } from '@/lib/domain/investments/types'

/**
 * Shapes shared between the asset-search server actions and the client panel
 * (Inversiones A4). Lives outside the 'use server' module because action
 * modules may only export async functions.
 */

/** One search hit — from the local `assets` table (has assetId) or a provider. */
export interface AssetOption {
  assetId: string | null
  assetType: AssetType
  coingeckoId: string | null
  currency: string | null
  exchange: string | null
  name: string
  ticker: string
}

/** What the form needs after the asset is upserted/loaded. */
export interface ResolvedAsset {
  currency: string
  id: string
  name: string
  ticker: string
  type: AssetType
}

/** Validates an AssetOption round-tripped through a server action call. */
export const assetOptionSchema = z.object({
  assetId: z.string().uuid().nullable(),
  assetType: z.enum(ASSET_TYPES),
  coingeckoId: z.string().max(100).nullable(),
  currency: z.string().max(3).nullable(),
  exchange: z.string().max(100).nullable(),
  name: z.string().min(1).max(200),
  ticker: z.string().min(1).max(30),
})
