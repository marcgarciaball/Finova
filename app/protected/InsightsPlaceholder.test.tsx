import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InsightsPlaceholder } from './InsightsPlaceholder'

describe('InsightsPlaceholder', () => {
  it('renders the title, a soon badge, and each preview item', () => {
    render(
      <InsightsPlaceholder
        title="Insights"
        soonLabel="Coming soon"
        items={['Monthly narrative', 'Leak finder', 'Forecast']}
      />
    )
    expect(screen.getByText('Insights')).toBeInTheDocument()
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
    expect(screen.getByText('Leak finder')).toBeInTheDocument()
  })
})
