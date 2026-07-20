import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import en from '@/messages/en.json'
import { DataHealthBanner } from './DataHealthBanner'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('./transactions/actions', () => ({
  recategorizeUncategorized: vi.fn(),
}))

function renderBanner(cents: number) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DataHealthBanner uncategorizedCents={cents} currency="EUR" locale="en" />
    </NextIntlClientProvider>
  )
}

describe('DataHealthBanner', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows the uncategorized amount and an organize action', () => {
    renderBanner(85837)
    expect(screen.getByText(/uncategorized/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /organize now/i })
    ).toBeInTheDocument()
  })

  it('renders nothing when there is nothing uncategorized', () => {
    const { container } = renderBanner(0)
    expect(container).toBeEmptyDOMElement()
  })

  it('stays hidden when already dismissed for this amount', () => {
    window.localStorage.setItem('finova:dataHealthDismissed', '85837')
    const { container } = renderBanner(85837)
    expect(container).toBeEmptyDOMElement()
  })
})
