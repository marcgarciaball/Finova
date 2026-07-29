import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type React from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import en from '@/messages/en.json'
import type { ActionResult } from './actions'
import { PropertyForm } from './PropertyForm'

function renderForm(
  action: (
    prev: ActionResult | undefined,
    formData: FormData
  ) => Promise<ActionResult>,
  onDone?: () => void,
  props?: Partial<React.ComponentProps<typeof PropertyForm>>
) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PropertyForm
        action={action}
        todayIso="2026-07-08"
        onDone={onDone}
        {...props}
      />
    </NextIntlClientProvider>
  )
}

beforeAll(() => {
  // jsdom lacks ResizeObserver, which the Radix Checkbox measures with.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

describe('PropertyForm', () => {
  it('submits the entered values and calls onDone on success', async () => {
    const action = vi.fn(async () => ({ ok: true as const }))
    const onDone = vi.fn()
    renderForm(action, onDone)

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Piso Eixample' },
    })
    fireEvent.change(screen.getByLabelText('Purchase date'), {
      target: { value: '2020-01-15' },
    })
    fireEvent.change(screen.getByLabelText('Purchase price'), {
      target: { value: '200000' },
    })
    fireEvent.change(screen.getByLabelText('Current estimated value'), {
      target: { value: '250000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save property' }))

    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
    const formData = action.mock.calls[0]?.[1] as FormData
    expect(formData.get('name')).toBe('Piso Eixample')
    expect(formData.get('type')).toBe('primary_home')
    expect(formData.get('currency')).toBe('EUR')
    expect(formData.get('purchasePrice')).toBe('200000')
    expect(formData.get('currentValue')).toBe('250000')
  })

  it('submits itemized purchase cost fields', async () => {
    const action = vi.fn(async () => ({ ok: true as const }))
    const onDone = vi.fn()
    renderForm(action, onDone)

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Piso Eixample' },
    })
    fireEvent.change(screen.getByLabelText('Purchase date'), {
      target: { value: '2020-01-15' },
    })
    fireEvent.change(screen.getByLabelText('Purchase price'), {
      target: { value: '200000' },
    })
    fireEvent.change(screen.getByLabelText('Current estimated value'), {
      target: { value: '250000' },
    })
    fireEvent.change(screen.getByLabelText('Transfer tax'), {
      target: { value: '15000' },
    })
    fireEvent.change(screen.getByLabelText('Notary'), {
      target: { value: '1200.50' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save property' }))

    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
    })
    const formData = action.mock.calls[0]?.[1] as FormData
    expect(formData.get('transferTax')).toBe('15000')
    expect(formData.get('notary')).toBe('1200.50')
    expect(formData.get('registry')).toBe('')
  })

  it('shows a field error from the action result', async () => {
    const action = vi.fn(async () => ({
      ok: false as const,
      error: 'validationFailed',
      fieldErrors: { purchasePrice: 'invalidAmount' },
    }))
    renderForm(action)

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Piso' },
    })
    fireEvent.change(screen.getByLabelText('Purchase date'), {
      target: { value: '2020-01-15' },
    })
    fireEvent.change(screen.getByLabelText('Purchase price'), {
      target: { value: 'abc' },
    })
    fireEvent.change(screen.getByLabelText('Current estimated value'), {
      target: { value: '250000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save property' }))

    await waitFor(() => {
      expect(screen.getByText('Enter a valid amount')).toBeInTheDocument()
    })
  })

  it('defaults ownership share to 100%', async () => {
    const action = vi.fn(async () => ({ ok: true as const }))
    renderForm(action, vi.fn())

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Piso Eixample' },
    })
    fireEvent.change(screen.getByLabelText('Purchase date'), {
      target: { value: '2020-01-15' },
    })
    fireEvent.change(screen.getByLabelText('Purchase price'), {
      target: { value: '200000' },
    })
    fireEvent.change(screen.getByLabelText('Current estimated value'), {
      target: { value: '250000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save property' }))

    await waitFor(() => expect(action).toHaveBeenCalled())
    const formData = action.mock.calls[0]?.[1] as FormData
    expect(formData.get('ownershipPct')).toBe('100')
  })

  it('edit mode pre-fills from initial values and omits purchase fields', async () => {
    const action = vi.fn(async () => ({ ok: true as const }))
    const onDone = vi.fn()
    renderForm(action, onDone, {
      mode: 'edit',
      initial: {
        id: 'prop-1',
        name: 'Piso Eixample',
        type: 'primary_home',
        address: 'Carrer Aragó 123',
        city: 'Barcelona',
        ownershipPct: 50,
        isRented: false,
        rentalStartDate: null,
        rentalEndDate: null,
        notes: null,
      },
    })

    expect(screen.queryByLabelText('Purchase price')).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Current estimated value')
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Transfer tax')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Piso Eixample')
    expect(screen.getByLabelText('Your ownership share (%)')).toHaveValue('50')

    fireEvent.change(screen.getByLabelText('Your ownership share (%)'), {
      target: { value: '60' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const formData = action.mock.calls[0]?.[1] as FormData
    expect(formData.get('id')).toBe('prop-1')
    expect(formData.get('ownershipPct')).toBe('60')
  })
})
