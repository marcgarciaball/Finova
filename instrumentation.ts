import type { Instrumentation } from 'next'

/**
 * Next's global server-error hook (P5-05) — fires for any uncaught error in
 * a Server Component, Route Handler, Server Action, or Middleware, so every
 * one of them reaches `error_logs` without a try/catch at every call site.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const { captureError } = await import('@/lib/observability/capture-error')
  await captureError(err, {
    path: request.path,
    routeType: context.routeType,
  })
}
