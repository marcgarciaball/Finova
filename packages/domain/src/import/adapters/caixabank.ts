/**
 * CaixaBank statement adapter (P2-04).
 *
 * Delimiter `;`, ES decimals, `dd/mm/yyyy` dates. Amounts are split across two
 * magnitude columns — `Cargo` (debit → expense, negative) and `Abono`
 * (credit → income, positive); exactly one is populated per row. `Concepto` is
 * the description; `Saldo` (running balance) is ignored. No ISO currency column,
 * so currency falls back to the account at import time.
 */

import { defineMappingAdapter } from './define-mapping-adapter'

export const caixabankAdapter = defineMappingAdapter({
  id: 'caixabank',
  signatureHeaders: ['Fecha', 'Concepto', 'Cargo', 'Abono', 'Saldo'],
  mapping: {
    amount: {
      kind: 'debitCredit',
      debitColumn: 'Cargo',
      creditColumn: 'Abono',
      decimal: ',',
    },
    date: { column: 'Fecha', format: 'dmy' },
    description: { column: 'Concepto' },
  },
})
