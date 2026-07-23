import Constants from 'expo-constants'

const webAppUrl = Constants.expoConfig?.extra?.webAppUrl as string | undefined

/**
 * Reuses the web app's existing self-hosted /api/log-error endpoint (P5-05)
 * — no separate mobile backend, no third-party crash SDK. Fire-and-forget:
 * a failed report must never surface to the user or crash the app further.
 */
export function reportError(error: unknown, context?: { path?: string }): void {
  if (!webAppUrl) {
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  fetch(`${webAppUrl}/api/log-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, stack, path: context?.path }),
  }).catch(() => {
    // Nothing further to do — this is the last line of defense.
  })
}
