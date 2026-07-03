import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BandSection } from './BandSection'

describe('BandSection', () => {
  it('renders the band title and its children', () => {
    render(
      <BandSection title="How much do I have?">
        <div>child</div>
      </BandSection>
    )
    expect(
      screen.getByRole('heading', { name: 'How much do I have?' })
    ).toBeInTheDocument()
    expect(screen.getByText('child')).toBeInTheDocument()
  })
})
