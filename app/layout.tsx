import type { Metadata } from 'next'
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { ThemeProvider } from 'next-themes'
import { Suspense } from 'react'
import { defaultLocale } from '@/lib/i18n/config'
import './globals.css'

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000'

// VERCEL_URL is platform-injected and normally safe, but a malformed value
// (e.g. an empty string on a misconfigured host) would otherwise throw here
// and crash every page render, so fall back to a known-good URL instead.
const metadataBaseUrl = (() => {
  try {
    return new URL(defaultUrl)
  } catch {
    return new URL('http://localhost:3000')
  }
})()

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl,
  title: 'Finova',
  description: 'One clear, trustworthy view of your money.',
}

const inter = Inter({
  variable: '--font-inter',
  display: 'swap',
  subsets: ['latin'],
})
const interTight = Inter_Tight({
  variable: '--font-inter-tight',
  display: 'swap',
  subsets: ['latin'],
})
const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  display: 'swap',
  subsets: ['latin'],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // `lang` is rendered into the static shell, so it uses the default locale.
  // The active per-request locale (from the cookie) drives the actual messages
  // inside the Suspense-streamed subtree below — see IntlProviders.
  return (
    <html lang={defaultLocale} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${interTight.variable} ${jetbrains.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense>
            <IntlProviders>{children}</IntlProviders>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  )
}

/**
 * Reads the cookie-based locale and messages. Kept under a `<Suspense>`
 * boundary so the request-time `cookies()` access doesn't block prerendering
 * of the static shell (required by `cacheComponents`). See ADR-004.
 */
async function IntlProviders({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
