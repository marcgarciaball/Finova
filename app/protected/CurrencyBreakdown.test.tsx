import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CurrencyBreakdown } from './CurrencyBreakdown'

describe('CurrencyBreakdown', () => {
  it('lists each currency and marks the base one', () => {
    render(
      <CurrencyBreakdown
        netWorthByCurrency={{ EUR: 869163, USD: -350 }}
        baseCurrency="EUR"
        locale="en"
        title="Net worth by currency"
        baseLabel="Base"
      />
    )
    expect(screen.getByText('Net worth by currency')).toBeInTheDocument()
    expect(screen.getByText('EUR')).toBeInTheDocument()
    expect(screen.getByText('USD')).toBeInTheDocument()
    // base currency is tagged
    expect(screen.getByText('Base')).toBeInTheDocument()
  })
})
