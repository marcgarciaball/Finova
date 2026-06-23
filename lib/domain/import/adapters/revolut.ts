/**
 * Revolut statement adapter (P2-04).
 *
 * Delimiter `,`, EN decimals (`1234.56`). `Completed Date` is an ISO datetime
 * (`YYYY-MM-DD HH:MM:SS`); `parseDateToIso` with `ymd` takes the date part (see
 * the datetime support in `locale-parse.ts`). The signed `Amount` is the amount
 * (negative = expense); `Description` is the description; `Currency` is a real
 * ISO code so it maps to per-row currency. `Fee`/`Balance`/`State` are ignored.
 */

import { defineMappingAdapter } from './define-mapping-adapter'

export const revolutAdapter = defineMappingAdapter({
  id: 'revolut',
  signatureHeaders: [
    'Completed Date',
    'Amount',
    'Currency',
    'State',
    'Balance',
  ],
  mapping: {
    amount: {
      kind: 'single',
      column: 'Amount',
      negativeIs: 'expense',
      decimal: '.',
    },
    currency: { column: 'Currency' },
    date: { column: 'Completed Date', format: 'ymd' },
    description: { column: 'Description' },
  },
})
