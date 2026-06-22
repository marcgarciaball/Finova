import type { Metadata } from 'next'
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { ThemeProvider } from 'next-themes'
import './globals.css'

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${interTight.variable} ${jetbrains.variable} font-sans antialiased`}
      >
        <NextIntlClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
