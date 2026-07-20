import 'server-only'
import { type LogContext, logger } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Self-hosted error tracking (P5-05). Always logs structurally (visible in
 * host logs immediately); best-effort persists to `error_logs` too, so
 * errors survive past log retention without a third-party error service.
 * Never throws — a broken error-reporting path must not break the request
 * that triggered it.
 */
export async function captureError(
  error: unknown,
  context?: LogContext & { digest?: string }
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  const { digest, ...rest } = context ?? {}

  logger.error(message, { digest, stack, ...rest })

  try {
    const admin = createAdminClient()
    await admin.from('error_logs').insert({
      context: Object.keys(rest).length > 0 ? rest : null,
      digest: digest ?? null,
      message,
      stack: stack ?? null,
    })
  } catch (e) {
    // The tracking path itself failing is not worth escalating further —
    // it's already visible via the console.error line above.
    logger.warn('captureError: failed to persist error_logs row', {
      reason: e instanceof Error ? e.message : String(e),
    })
  }
}
