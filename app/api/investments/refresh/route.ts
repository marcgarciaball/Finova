import { NextResponse } from 'next/server'
import { refreshPrices } from '@/lib/investments/jobs/refresh-prices'

/**
 * Cron/manual trigger for the price-refresh job (Inversiones A5). Guarded by
 * a bearer CRON_SECRET (Vercel Cron sends it automatically once configured
 * in Phase B); GET so both cron services and a browser/curl can hit it.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const summary = await refreshPrices()
    return NextResponse.json({ ok: true, summary })
  } catch (e) {
    console.error('refresh job failed:', e)
    return NextResponse.json({ error: 'failed', ok: false }, { status: 500 })
  }
}
