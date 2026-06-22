import { render, screen } from '@testing-library/react'
import { Button } from './button'

test('brand variant applies brand background and is min 40px tall', () => {
  render(<Button variant="brand">Save</Button>)
  const btn = screen.getByRole('button', { name: 'Save' })
  expect(btn.className).toContain('bg-brand')
  expect(btn.className).toContain('h-11')
})

test('glass variant applies glass border', () => {
  render(<Button variant="glass">Filter</Button>)
  expect(screen.getByRole('button', { name: 'Filter' }).className).toContain(
    'border-glass-line'
  )
})
