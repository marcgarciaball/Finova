import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TRANSACTION_SORT,
  parseTransactionSort,
  transactionSortColumn,
} from './sort'

describe('parseTransactionSort', () => {
  it('falls back to the default when absent or malformed', () => {
    expect(parseTransactionSort({})).toEqual(DEFAULT_TRANSACTION_SORT)
    expect(parseTransactionSort({ sort: 'bogus', dir: 'bogus' })).toEqual(
      DEFAULT_TRANSACTION_SORT
    )
  })

  it('parses a valid field and direction', () => {
    expect(parseTransactionSort({ sort: 'amount', dir: 'asc' })).toEqual({
      field: 'amount',
      dir: 'asc',
    })
  })

  it('takes the first value when a param is repeated', () => {
    expect(
      parseTransactionSort({ sort: ['description', 'amount'], dir: 'desc' })
    ).toEqual({ field: 'description', dir: 'desc' })
  })
})

describe('transactionSortColumn', () => {
  it('maps each field to its underlying column', () => {
    expect(transactionSortColumn({ field: 'date', dir: 'desc' })).toEqual({
      column: 'occurred_at',
      ascending: false,
    })
    expect(transactionSortColumn({ field: 'amount', dir: 'asc' })).toEqual({
      column: 'amount_cents',
      ascending: true,
    })
    expect(transactionSortColumn({ field: 'description', dir: 'asc' })).toEqual(
      { column: 'description', ascending: true }
    )
  })
})
