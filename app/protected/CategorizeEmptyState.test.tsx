import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CategorizeEmptyState } from './CategorizeEmptyState'

describe('CategorizeEmptyState', () => {
  it('renders the prompt and a link to transactions', () => {
    render(
      <CategorizeEmptyState
        title="Nothing categorized yet"
        body="All your spending is uncategorized."
        cta="Organize spending"
      />
    )
    expect(screen.getByText('Nothing categorized yet')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Organize spending' })
    expect(link).toHaveAttribute('href', '/protected/transactions')
  })
})
