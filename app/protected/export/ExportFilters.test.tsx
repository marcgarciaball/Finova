import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'
import type { AccountRow } from '@/lib/validation/account'
import type { CategoryRow } from '@/lib/validation/category'
import en from '@/messages/en.json'
import { ExportFilters } from './ExportFilters'
import type { ExportView } from './export-view'

const account: AccountRow = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'u1',
  name: 'Sabadell',
  type: 'checking',
  currency: 'EUR',
  opening_balance: 0,
  archived: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const category: CategoryRow = {
  id: '22222222-2222-4222-8222-222222222222',
  user_id: 'u1',
  parent_id: null,
  name: 'Groceries',
  name_key: null,
  kind: 'expense',
  is_default: false,
  icon_name: null,
  color: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function renderFilters(view: ExportView = 'transactions') {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ExportFilters view={view} accounts={[account]} categories={[category]} />
    </NextIntlClientProvider>
  )
}

const csvHref = () =>
  screen.getByRole('link', { name: /download csv/i }).getAttribute('href')
const jsonHref = () =>
  screen.getByRole('link', { name: /download json/i }).getAttribute('href')

describe('ExportFilters', () => {
  it('defaults the transactions view to unfiltered downloads', () => {
    renderFilters()
    expect(csvHref()).toBe('/protected/export/transactions.csv')
    expect(jsonHref()).toBe(
      '/protected/export/backup.json?domains=transactions'
    )
    expect(screen.queryByText(/filters narrow/i)).not.toBeInTheDocument()
  })

  it('adds account and category params to both hrefs', () => {
    renderFilters()
    fireEvent.change(screen.getByLabelText('Account'), {
      target: { value: account.id },
    })
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: category.id },
    })
    expect(csvHref()).toBe(
      `/protected/export/transactions.csv?account=${account.id}&category=${category.id}`
    )
    expect(jsonHref()).toBe(
      `/protected/export/backup.json?domains=transactions&account=${account.id}&category=${category.id}`
    )
    expect(screen.getByText(/filters narrow/i)).toBeInTheDocument()
  })

  it('fills the date inputs from a preset', () => {
    renderFilters()
    fireEvent.click(screen.getByRole('button', { name: 'This year' }))
    const from = screen.getByLabelText('From') as HTMLInputElement
    expect(from.value).toMatch(/^\d{4}-01-01$/)
    expect(csvHref()).toContain('from=')
    expect(csvHref()).toContain('to=')
  })

  it('custom dates override the preset selection', () => {
    renderFilters()
    fireEvent.click(screen.getByRole('button', { name: 'This year' }))
    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '2026-03-15' },
    })
    expect(csvHref()).toContain('from=2026-03-15')
    expect(screen.getByRole('button', { name: 'This year' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('hides the filter bar and points at unfiltered routes for real estate', () => {
    renderFilters('realEstate')
    expect(screen.queryByLabelText('Account')).not.toBeInTheDocument()
    expect(csvHref()).toBe('/protected/export/real-estate.csv')
    expect(jsonHref()).toBe('/protected/export/backup.json?domains=realEstate')
  })
})
