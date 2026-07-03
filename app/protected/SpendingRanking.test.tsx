import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { type RankRow, SpendingRanking } from './SpendingRanking'

const rows: RankRow[] = [
  {
    key: 'a',
    label: 'Groceries',
    total: 5000,
    share: 0.5,
    currency: 'EUR',
    trend: 'up',
  },
  {
    key: 'b',
    label: 'Transport',
    total: 5000,
    share: 0.5,
    currency: 'EUR',
    trend: 'down',
  },
]

describe('SpendingRanking', () => {
  it('marks the trend direction per row', () => {
    render(
      <SpendingRanking
        title="Where you spend most"
        rows={rows}
        locale="en"
        emptyLabel="No spending in this period."
      />
    )
    expect(screen.getByLabelText('trend-up')).toBeInTheDocument()
    expect(screen.getByLabelText('trend-down')).toBeInTheDocument()
  })

  it('shows the empty label when there are no rows', () => {
    render(
      <SpendingRanking
        title="Where you spend most"
        rows={[]}
        locale="en"
        emptyLabel="No spending in this period."
      />
    )
    expect(screen.getByText('No spending in this period.')).toBeInTheDocument()
  })
})
