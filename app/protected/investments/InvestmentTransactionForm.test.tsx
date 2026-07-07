import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import type { ResolvedAsset } from '@/lib/investments/asset-option'
import en from '@/messages/en.json'
import type { ActionResult } from './actions'
import { InvestmentTransactionForm } from './InvestmentTransactionForm'

const asset: ResolvedAsset = {
  currency: 'USD',
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Apple Inc',
  ticker: 'AAPL',
  type: 'stock',
}

function renderForm(
  action: (
    prev: ActionResult | undefined,
    formData: FormData
  ) => Promise<ActionResult>
) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <InvestmentTransactionForm
        action={action}
        asset={asset}
        todayIso="2026-07-07"
      />
    </NextIntlClientProvider>
  )
}

describe('InvestmentTransactionForm', () => {
  it('defaults date to today and currency to the asset currency', () => {
    renderForm(vi.fn(async () => ({ ok: true as const })))
    expect(
      (screen.getByLabelText('Trade date') as HTMLInputElement).value
    ).toBe('2026-07-07')
    expect((screen.getByLabelText('Currency') as HTMLInputElement).value).toBe(
      'USD'
    )
  })

  it('submits the asset id and entered values, then confirms', async () => {
    const action = vi.fn(async () => ({ ok: true as const }))
    renderForm(action)
    fireEvent.change(screen.getByLabelText('Quantity'), {
      target: { value: '0.5' },
    })
    fireEvent.change(screen.getByLabelText('Price per unit'), {
      target: { value: '190.55' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }))
    await waitFor(() => {
      expect(screen.getByText('Added')).toBeInTheDocument()
    })
    const formData = action.mock.calls[0]?.[1] as FormData
    expect(formData.get('assetId')).toBe(asset.id)
    expect(formData.get('type')).toBe('buy')
    expect(formData.get('quantity')).toBe('0.5')
    expect(formData.get('price')).toBe('190.55')
  })

  it('shows the oversell error inline on the quantity field', async () => {
    const action = vi.fn(async () => ({
      ok: false as const,
      error: 'validationFailed',
      fieldErrors: { quantity: 'oversell' },
    }))
    renderForm(action)
    fireEvent.change(screen.getByLabelText('Quantity'), {
      target: { value: '99' },
    })
    fireEvent.change(screen.getByLabelText('Price per unit'), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }))
    await waitFor(() => {
      expect(
        screen.getByText("You can't sell more than you hold.")
      ).toBeInTheDocument()
    })
  })
})
