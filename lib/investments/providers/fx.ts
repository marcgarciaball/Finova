import { z } from 'zod'
import { ProviderError } from './types'

/**
 * Frankfurter FX client (Inversiones A3) — free, keyless ECB daily rates
 * (exchangerate.host now requires an API key, so the build prompt's choice
 * was swapped). One call per base currency; the A5 daily job upserts the
 * result into `fx_rates`.
 */

const BASE_URL = 'https://api.frankfurter.app'

export interface DailyFxRates {
  rateDate: string // ECB business day, provider's `date`
  rates: { fromCcy: string; rate: number; toCcy: string }[]
}

const responseSchema = z.object({
  base: z.string(),
  date: z.string(),
  rates: z.record(z.string(), z.number()),
})

export async function fetchDailyRates(
  from: string,
  to: string[],
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<DailyFxRates> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const res = await fetchImpl(
    `${BASE_URL}/latest?from=${encodeURIComponent(from)}&to=${to.map(encodeURIComponent).join(',')}`
  )
  if (!res.ok) {
    throw new ProviderError('frankfurter', 'http', res.status)
  }
  const parsed = responseSchema.safeParse(await res.json())
  if (!parsed.success) {
    throw new ProviderError('frankfurter', 'malformed')
  }
  return {
    rateDate: parsed.data.date,
    rates: Object.entries(parsed.data.rates).map(([toCcy, rate]) => ({
      fromCcy: parsed.data.base,
      rate,
      toCcy,
    })),
  }
}
