'use client'

import { useEffect } from 'react'

/**
 * Root-layout error boundary (P5-05) — only fires if the root layout itself
 * throws, so it renders its own <html>/<body> and can't depend on the
 * providers (i18n, theme) that may be exactly what's broken.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/log-error', {
      body: JSON.stringify({
        digest: error.digest,
        message: error.message,
        path: window.location.pathname,
        stack: error.stack,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: controller.signal,
    }).catch(() => {})
    return () => controller.abort()
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          alignItems: 'center',
          display: 'flex',
          fontFamily: 'system-ui, sans-serif',
          height: '100vh',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. It has been logged.</p>
          <button onClick={reset} type="button">
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
